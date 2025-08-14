package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"report-management-system/internal/db"
	"report-management-system/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// --- helpers ---
func todayStr() string { return time.Now().Format("2006-01-02") }

func clampHours(h float64) float64 {
	if h < 0 {
		return 0
	}
	if h > 24 {
		return 24
	}
	return h
}

// Farklı şemaları (userId/uid/user_id) ve tipleri (ObjectID/string) kapsayan kullanıcı filtresi
func userMatchFilter(uid primitive.ObjectID) bson.M {
	hex := uid.Hex()
	return bson.M{
		"$or": []bson.M{
			{"userId": uid},
			{"userId": hex},
			{"uid": uid},
			{"uid": hex},
			{"user_id": uid},
			{"user_id": hex},
		},
	}
}

// POST /api/reports  (JWT) — bugüne rapor upsert
func CreateOrUpdateMyReport(c *gin.Context) {
	var body struct {
		Content string  `json:"content"`
		Hours   float64 `json:"hours"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content required"})
		return
	}

	uidHex := c.GetString("userId")
	uid, err := primitive.ObjectIDFromHex(uidHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	// kullanıcı bilgisi (adı/rolü cache etmek için)
	var u models.User
	if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": uid}).Decode(&u); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	filter := bson.M{"userId": uid, "date": todayStr()}
	update := bson.M{
		"$set": bson.M{
			"content":  strings.TrimSpace(body.Content),
			"hours":    clampHours(body.Hours),
			"userName": u.Name,
			"role":     u.Role,
		},
		"$setOnInsert": bson.M{
			"createdAt": time.Now(),
			"userId":    uid,
			"date":      todayStr(),
		},
	}
	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var rep models.Report
	if err := db.Col("reports").
		FindOneAndUpdate(c.Request.Context(), filter, update, opts).
		Decode(&rep); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rep)
}

// GET /api/reports/me/today  (JWT)
func GetMyTodayReport(c *gin.Context) {
	uidHex := c.GetString("userId")
	uid, err := primitive.ObjectIDFromHex(uidHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	// Hem eski hem yeni şema:
	filter := bson.M{
		"$and": []bson.M{
			userMatchFilter(uid),
			{"date": todayStr()},
		},
	}

	var rep models.Report
	err = db.Col("reports").
		FindOne(c.Request.Context(), filter).
		Decode(&rep)

	if err == mongo.ErrNoDocuments {
		c.JSON(http.StatusOK, gin.H{"report": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"report": rep})
}

// GET /api/reports/me/history?limit=50&skip=0  (JWT)
func GetMyReportsHistory(c *gin.Context) {
	uidHex := c.GetString("userId")
	uid, err := primitive.ObjectIDFromHex(uidHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	limit := int64(50)
	skip := int64(0)
	if v := c.Query("limit"); v != "" {
		if n, e := strconv.ParseInt(v, 10, 64); e == nil {
			if n > 0 && n <= 200 {
				limit = n
			}
		}
	}
	if v := c.Query("skip"); v != "" {
		if n, e := strconv.ParseInt(v, 10, 64); e == nil && n >= 0 {
			skip = n
		}
	}

	// Sadece kullanıcıya göre filtrele — şema/tipe tolerant olsun
	filter := userMatchFilter(uid)

	cur, err := db.Col("reports").Find(
		c.Request.Context(),
		filter,
		options.Find().
			SetSort(bson.D{{Key: "date", Value: -1}}).
			SetLimit(limit).
			SetSkip(skip),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var items []models.Report
	if err := cur.All(c.Request.Context(), &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/reports/user/:id?limit=50&skip=0[&from=YYYY-MM-DD&to=YYYY-MM-DD]
// (admin/superadmin) — belirli bir kullanıcının rapor geçmişi
func GetUserReports(c *gin.Context) {
	idHex := c.Param("id")
	uid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	// opsiyoneller
	limit := int64(50)
	skip := int64(0)

	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		if n, e := strconv.ParseInt(v, 10, 64); e == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := strings.TrimSpace(c.Query("skip")); v != "" {
		if n, e := strconv.ParseInt(v, 10, 64); e == nil && n >= 0 {
			skip = n
		}
	}

	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))

	// DİKKAT !!!: Burayı genişletmiyoruz (decode eski şemada patlayabilir).
	// Yönetici tarafı için istersek ayrıca DTO ile decode edebiliriz.
	filter := bson.M{"userId": uid}
	if from != "" || to != "" {
		dc := bson.M{}
		if from != "" {
			dc["$gte"] = from
		}
		if to != "" {
			dc["$lte"] = to
		}
		filter["date"] = dc
	}

	cur, err := db.Col("reports").Find(
		c.Request.Context(),
		filter,
		options.Find().
			SetSort(bson.D{{Key: "date", Value: -1}}).
			SetLimit(limit).
			SetSkip(skip),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var items []models.Report
	if err := cur.All(c.Request.Context(), &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/reports/today?date=YYYY-MM-DD  (admin/superadmin)
func GetReportsByDay(c *gin.Context) {
	date := c.Query("date")
	if strings.TrimSpace(date) == "" {
		date = todayStr()
	}

	cur, err := db.Col("reports").Find(c.Request.Context(), bson.M{"date": date})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var reports []models.Report
	if err := cur.All(c.Request.Context(), &reports); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// user bilgisi fallback için
	ids := make([]primitive.ObjectID, 0, len(reports))
	seen := map[primitive.ObjectID]struct{}{}
	for _, r := range reports {
		if _, ok := seen[r.UserID]; !ok {
			ids = append(ids, r.UserID)
			seen[r.UserID] = struct{}{}
		}
	}

	usersByID := map[primitive.ObjectID]models.User{}
	if len(ids) > 0 {
		cur2, err := db.Col("users").Find(c.Request.Context(), bson.M{"_id": bson.M{"$in": ids}})
		if err == nil {
			var us []models.User
			_ = cur2.All(c.Request.Context(), &us)
			for _, u := range us {
				usersByID[u.ID] = u
			}
		}
	}

	type DTO struct {
		ID        string    `json:"id"`
		UserID    string    `json:"userId"`
		UserName  string    `json:"userName"`
		Role      string    `json:"role"`
		Date      string    `json:"date"`
		Content   string    `json:"content"`
		Hours     float64   `json:"hours,omitempty"`
		CreatedAt time.Time `json:"createdAt"`
	}
	out := make([]DTO, 0, len(reports))
	for _, r := range reports {
		u := usersByID[r.UserID]
		name := r.UserName
		role := string(r.Role)
		if name == "" && u.Name != "" {
			name = u.Name
		}
		if role == "" && u.Role != "" {
			role = string(u.Role)
		}
		out = append(out, DTO{
			ID:        r.ID.Hex(),
			UserID:    r.UserID.Hex(),
			UserName:  name,
			Role:      role,
			Date:      r.Date,
			Content:   r.Content,
			Hours:     r.Hours,
			CreatedAt: r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"date": date, "items": out})
}

// GET /api/reports/search?q=keyword[&department=Dept][&from=YYYY-MM-DD&to=YYYY-MM-DD]
// (admin/superadmin)
func SearchReports(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	dep := strings.TrimSpace(c.Query("department"))
	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))

	filter := bson.M{}
	ands := []bson.M{}

	if q != "" {
		ands = append(ands, bson.M{"content": bson.M{"$regex": q, "$options": "i"}})
	}

	if dep != "" {
		// department için users tablosundan userId set’i çıkar
		cur, err := db.Col("users").Find(
			c.Request.Context(),
			bson.M{"department": dep},
			options.Find().SetProjection(bson.M{"_id": 1}),
		)
		if err == nil {
			var ids []primitive.ObjectID
			for cur.Next(c.Request.Context()) {
				var row struct {
					ID primitive.ObjectID `bson:"_id"`
				}
				_ = cur.Decode(&row)
				ids = append(ids, row.ID)
			}
			_ = cur.Close(c.Request.Context())
			if len(ids) == 0 {
				c.JSON(http.StatusOK, gin.H{"items": []any{}})
				return
			}
			ands = append(ands, bson.M{"userId": bson.M{"$in": ids}})
		}
	}

	if from != "" || to != "" {
		dateCond := bson.M{}
		if from != "" {
			dateCond["$gte"] = from
		}
		if to != "" {
			dateCond["$lte"] = to
		}
		ands = append(ands, bson.M{"date": dateCond})
	}

	if len(ands) > 0 {
		filter["$and"] = ands
	}

	cur, err := db.Col("reports").Find(
		c.Request.Context(),
		filter,
		options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(200),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var items []models.Report
	if err := cur.All(c.Request.Context(), &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/reports/status?department=Engineering[&date=YYYY-MM-DD]
// (admin/superadmin)
func GetReportStatus(c *gin.Context) {
	dep := strings.TrimSpace(c.Query("department"))
	date := strings.TrimSpace(c.Query("date"))
	if date == "" {
		date = todayStr()
	}
	if dep == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "department is required"})
		return
	}

	// departmandaki kullanıcılar
	cur, err := db.Col("users").Find(c.Request.Context(), bson.M{"department": dep})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var users []models.User
	if err := cur.All(c.Request.Context(), &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(users) == 0 {
		c.JSON(http.StatusOK, gin.H{"date": date, "department": dep, "items": []any{}})
		return
	}

	ids := make([]primitive.ObjectID, 0, len(users))
	hexIDs := make([]string, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
		hexIDs = append(hexIDs, u.ID.Hex())
	}

	// o gün rapor gönderenler (ObjectID veya string ID)
	rmap := map[primitive.ObjectID]models.Report{}
	rcur, err := db.Col("reports").Find(
		c.Request.Context(),
		bson.M{
			"$and": []bson.M{
				{"date": date},
				{"$or": []bson.M{
					{"userId": bson.M{"$in": ids}},
					{"userId": bson.M{"$in": hexIDs}},
					{"uid": bson.M{"$in": ids}},
					{"uid": bson.M{"$in": hexIDs}},
					{"user_id": bson.M{"$in": ids}},
					{"user_id": bson.M{"$in": hexIDs}},
				}},
			},
		},
	)
	if err == nil {
		for rcur.Next(c.Request.Context()) {
			// Eski kayıtlarda decode sorun olmasın diye toleranslı oku
			var r models.Report
			if err := rcur.Decode(&r); err == nil && r.UserID != primitive.NilObjectID {
				rmap[r.UserID] = r
			}
		}
		_ = rcur.Close(c.Request.Context())
	}

	type Row struct {
		UserID   string `json:"userId"`
		Name     string `json:"name"`
		HasToday bool   `json:"hasReportToday"`
		Hours    string `json:"hours,omitempty"`
	}
	out := make([]Row, 0, len(users))
	for _, u := range users {
		if rep, ok := rmap[u.ID]; ok {
			hrs := ""
			if rep.Hours > 0 {
				hrs = strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", rep.Hours), "0"), ".")
			}
			out = append(out, Row{
				UserID:   u.ID.Hex(),
				Name:     u.Name,
				HasToday: true,
				Hours:    hrs,
			})
			continue
		}
		out = append(out, Row{
			UserID:   u.ID.Hex(),
			Name:     u.Name,
			HasToday: false,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"date":       date,
		"department": dep,
		"items":      out,
	})
}

// GET /api/reports/user/:id?from=YYYY-MM-DD&to=YYYY-MM-DD  (admin/superadmin)
func GetReportsByUser(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}

	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))

	filter := bson.M{"userId": oid}
	if from != "" || to != "" {
		dateCond := bson.M{}
		if from != "" {
			dateCond["$gte"] = from
		}
		if to != "" {
			dateCond["$lte"] = to
		}
		filter["date"] = dateCond
	}

	cur, err := db.Col("reports").Find(
		c.Request.Context(),
		filter,
		options.Find().SetSort(bson.D{{Key: "date", Value: -1}}),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var items []models.Report
	if err := cur.All(c.Request.Context(), &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/reports/department/series?department=Sales&period=7d|30d|6m|12m
// admin: sadece kendi departmanını görebilir, superadmin: herkesi görebilir
// GET /api/reports/department/series?department=Sales&period=7d|30d|6m|12m
func GetDepartmentSeries(c *gin.Context) {
	ctx := c.Request.Context()
	role := c.GetString("role")

	dep := strings.TrimSpace(c.Query("department"))
	period := strings.TrimSpace(c.Query("period"))
	if period == "" {
		period = "7d"
	}

	// --- yetki / departman doğrulama ---
	switch role {
	case string(models.RoleAdmin):
		uidHex := c.GetString("userId")
		uid, _ := primitive.ObjectIDFromHex(uidHex)
		var me models.User
		if err := db.Col("users").FindOne(ctx, bson.M{"_id": uid}).Decode(&me); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
			return
		}
		if strings.TrimSpace(me.Department) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user has no department"})
			return
		}
		if dep == "" {
			dep = me.Department
		}
		if dep != me.Department {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	case string(models.RoleSuperAdmin):
		if dep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "department is required"})
			return
		}
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// --- departman kullanıcıları (case-insensitive eşleşme) ---
	depRegex := bson.M{"$regex": "^" + regexp.QuoteMeta(dep) + "$", "$options": "i"}
	ucur, err := db.Col("users").Find(
		ctx,
		bson.M{"department": depRegex},
		options.Find().SetProjection(bson.M{"_id": 1, "name": 1}),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var users []models.User
	if err := ucur.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(users) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"series": []any{},
			"cards":  gin.H{"totalHours": 0, "avgHours": 0, "reportsToday": 0, "activeEmployees": 0},
			"top":    []any{},
		})
		return
	}

	ids := make([]primitive.ObjectID, 0, len(users))
	hexIDs := make([]string, 0, len(users))
	nameBy := map[primitive.ObjectID]string{}
	for _, u := range users {
		ids = append(ids, u.ID)
		hexIDs = append(hexIDs, u.ID.Hex())
		nameBy[u.ID] = u.Name
	}

	// --- zaman aralığı ---
	now := time.Now()
	todayISO := now.Format("2006-01-02")
	monthly := false
	var from time.Time
	var days int
	switch period {
	case "30d":
		days = 30
	case "6m":
		monthly = true
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -5, 0)
	case "12m":
		monthly = true
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -11, 0)
	default: // "7d"
		days = 7
	}
	if !monthly {
		if days == 0 {
			days = 7
		}
		from = now.AddDate(0, 0, -(days - 1))
	}
	fromISO := from.Format("2006-01-02")
	toISO := todayISO

	// --- raporlar ---
	rfilter := bson.M{
		"$and": []bson.M{
			{"date": bson.M{"$gte": fromISO, "$lte": toISO}},
			{"$or": []bson.M{
				{"userId": bson.M{"$in": ids}},
				{"userId": bson.M{"$in": hexIDs}},
				{"uid": bson.M{"$in": ids}},
				{"uid": bson.M{"$in": hexIDs}},
				{"user_id": bson.M{"$in": ids}},
				{"user_id": bson.M{"$in": hexIDs}},
			}},
		},
	}
	rcur, err := db.Col("reports").Find(ctx, rfilter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rcur.Close(ctx)

	// --- toplama ---
	daily := map[string]float64{}
	monthlyM := map[string]float64{}
	totalHours := 0.0
	reportCnt := 0
	reportsToday := 0
	activeUsers := map[primitive.ObjectID]struct{}{}
	perUserH := map[primitive.ObjectID]float64{}
	perUserC := map[primitive.ObjectID]int{}

	for rcur.Next(ctx) {
		var r models.Report
		if err := rcur.Decode(&r); err != nil {
			continue
		}
		h := clampHours(r.Hours)
		totalHours += h
		reportCnt++
		if r.Date == todayISO {
			reportsToday++
		}
		if r.UserID != primitive.NilObjectID {
			activeUsers[r.UserID] = struct{}{}
			perUserH[r.UserID] += h
			perUserC[r.UserID]++
		}
		daily[r.Date] += h
		if len(r.Date) >= 7 {
			monthlyM[r.Date[:7]] += h
		}
	}

	avg := 0.0
	if reportCnt > 0 {
		avg = totalHours / float64(reportCnt)
	}

	type DP struct {
		Label string  `json:"label"`
		Hours float64 `json:"hours"`
	}
	series := []DP{}
	if monthly {
		months := 6
		if period == "12m" {
			months = 12
		}
		base := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		for i := months - 1; i >= 0; i-- {
			d := base.AddDate(0, -i, 0)
			key := d.Format("2006-01")
			series = append(series, DP{Label: d.Format("Jan 06"), Hours: monthlyM[key]})
		}
	} else {
		for i := days - 1; i >= 0; i-- {
			d := now.AddDate(0, 0, -i)
			key := d.Format("2006-01-02")
			series = append(series, DP{Label: d.Format("02 Jan"), Hours: daily[key]})
		}
	}

	// top contributors (ilk 5)
	type Top struct {
		UserId   string  `json:"userId"`
		UserName string  `json:"userName"`
		Hours    float64 `json:"hours"`
		Reports  int     `json:"reports"`
	}
	tops := make([]Top, 0, len(perUserH))
	for uid, h := range perUserH {
		tops = append(tops, Top{UserId: uid.Hex(), UserName: nameBy[uid], Hours: h, Reports: perUserC[uid]})
	}
	sort.Slice(tops, func(i, j int) bool { return tops[i].Hours > tops[j].Hours })
	if len(tops) > 5 {
		tops = tops[:5]
	}

	c.JSON(http.StatusOK, gin.H{
		"series": series,
		"cards": gin.H{
			"totalHours":      totalHours,
			"avgHours":        avg,
			"reportsToday":    reportsToday,
			"activeEmployees": len(activeUsers),
		},
		// geriye uyumluluk (UI başka yerde top-level okuyorsa):
		"totalHours":        totalHours,
		"avgHoursPerReport": avg,
		"reportsToday":      reportsToday,
		"activeEmployees":   len(activeUsers),
		"top":               tops,
	})
}

// GET /api/reports/department/breakdown?department=Sales&period=7d|30d|6m|12m&top=5
func GetDepartmentBreakdown(c *gin.Context) {
	ctx := c.Request.Context()
	role := c.GetString("role")

	dep := strings.TrimSpace(c.Query("department"))
	period := strings.TrimSpace(c.Query("period"))
	if period == "" {
		period = "7d"
	}

	// --- yetki kontrolü (aynı) ---
	switch role {
	case string(models.RoleAdmin):
		uidHex := c.GetString("userId")
		uid, _ := primitive.ObjectIDFromHex(uidHex)
		var me models.User
		if err := db.Col("users").FindOne(ctx, bson.M{"_id": uid}).Decode(&me); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
			return
		}
		if strings.TrimSpace(me.Department) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user has no department"})
			return
		}
		if dep == "" {
			dep = me.Department
		}
		if dep != me.Department {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	case string(models.RoleSuperAdmin):
		if dep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "department is required"})
			return
		}
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// --- departman kullanıcıları (case-insensitive) ---
	depRegex := bson.M{"$regex": "^" + regexp.QuoteMeta(dep) + "$", "$options": "i"}
	ucur, err := db.Col("users").Find(ctx, bson.M{"department": depRegex}, options.Find().SetProjection(bson.M{"_id": 1, "name": 1}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var users []models.User
	if err := ucur.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(users) == 0 {
		c.JSON(http.StatusOK, gin.H{"labels": []any{}, "series": []any{}})
		return
	}

	ids := make([]primitive.ObjectID, 0, len(users))
	hexIDs := make([]string, 0, len(users))
	nameBy := map[primitive.ObjectID]string{}
	for _, u := range users {
		ids = append(ids, u.ID)
		hexIDs = append(hexIDs, u.ID.Hex())
		nameBy[u.ID] = u.Name
	}

	// --- tarih aralığı ---
	now := time.Now()
	monthly := false
	var from time.Time
	var days int
	switch period {
	case "30d":
		days = 30
	case "6m":
		monthly = true
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -5, 0)
	case "12m":
		monthly = true
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -11, 0)
	default:
		days = 7
	}
	if !monthly {
		if days == 0 {
			days = 7
		}
		from = now.AddDate(0, 0, -(days - 1))
	}
	fromISO := from.Format("2006-01-02")
	toISO := now.Format("2006-01-02")

	// --- raporlar ---
	rfilter := bson.M{
		"$and": []bson.M{
			{"date": bson.M{"$gte": fromISO, "$lte": toISO}},
			{"$or": []bson.M{
				{"userId": bson.M{"$in": ids}},
				{"userId": bson.M{"$in": hexIDs}},
				{"uid": bson.M{"$in": ids}},
				{"uid": bson.M{"$in": hexIDs}},
				{"user_id": bson.M{"$in": ids}},
				{"user_id": bson.M{"$in": hexIDs}},
			}},
		},
	}
	rcur, err := db.Col("reports").Find(ctx, rfilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rcur.Close(ctx)

	daily := map[string]map[primitive.ObjectID]float64{}
	totalByUser := map[primitive.ObjectID]float64{}

	for rcur.Next(ctx) {
		var r models.Report
		if err := rcur.Decode(&r); err != nil {
			continue
		}
		key := r.Date
		if monthly && len(r.Date) >= 7 {
			key = r.Date[:7]
		}
		if _, ok := daily[key]; !ok {
			daily[key] = map[primitive.ObjectID]float64{}
		}
		h := clampHours(r.Hours)
		if r.UserID != primitive.NilObjectID {
			daily[key][r.UserID] += h
			totalByUser[r.UserID] += h
		}
	}

	// etiketler
	var keys []string
	var labels []string
	if monthly {
		months := 6
		if period == "12m" {
			months = 12
		}
		base := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		for i := months - 1; i >= 0; i-- {
			d := base.AddDate(0, -i, 0)
			keys = append(keys, d.Format("2006-01"))
			labels = append(labels, d.Format("Jan 06"))
		}
	} else {
		for i := days - 1; i >= 0; i-- {
			d := now.AddDate(0, 0, -i)
			keys = append(keys, d.Format("2006-01-02"))
			labels = append(labels, d.Format("02 Jan"))
		}
	}

	// top param: >0 ise ilk N, yoksa hepsi
	top := -1
	if v := strings.TrimSpace(c.Query("top")); v != "" {
		if n, e := strconv.Atoi(v); e == nil {
			top = n
		}
	}

	type kv struct {
		ID  primitive.ObjectID
		Val float64
	}
	arr := make([]kv, 0, len(totalByUser))
	for id, v := range totalByUser {
		arr = append(arr, kv{id, v})
	}
	sort.Slice(arr, func(i, j int) bool { return arr[i].Val > arr[j].Val })
	if top > 0 && len(arr) > top {
		arr = arr[:top]
	}

	type Serie struct {
		UserId   string    `json:"userId"`
		UserName string    `json:"userName"`
		Points   []float64 `json:"points"`
		Total    float64   `json:"total"`
	}
	out := make([]Serie, 0, len(arr))
	for _, row := range arr {
		points := make([]float64, len(keys))
		for i, k := range keys {
			points[i] = daily[k][row.ID]
		}
		out = append(out, Serie{
			UserId:   row.ID.Hex(),
			UserName: nameBy[row.ID],
			Points:   points,
			Total:    row.Val,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"department": dep,
		"period":     period,
		"labels":     labels,
		"dates":      keys,
		"series":     out,
	})
}
