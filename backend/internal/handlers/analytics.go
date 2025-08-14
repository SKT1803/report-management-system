package handlers

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"report-management-system/internal/db"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

type companyStats struct {
	TotalEmployees int64   `json:"totalEmployees"`
	ReportsToday   int64   `json:"reportsToday"`
	Departments    int64   `json:"departments"`
	AvgHours       float64 `json:"avgHours"`
}

type deptOverview struct {
	Department   string  `json:"department"`
	Employees    int64   `json:"employees"`
	ReportsToday int64   `json:"reportsToday"`
	AvgHours     float64 `json:"avgHours"` // seçilen periyottaki ortalama saat
}

type compareSeries struct {
	Labels []string `json:"labels"`
	Series []struct {
		Department string    `json:"department"`
		Points     []float64 `json:"points"`
	} `json:"series"`
}

// GET /api/analytics/company?period=7d|30d|6m|12m
func CompanyAnalytics(c *gin.Context) {
	ctx := c.Request.Context()
	users := db.Col("users")
	reports := db.Col("reports")

	// ----- period paramı -----
	period := c.DefaultQuery("period", "7d")
	var mode string // "days" | "months"
	var n int
	switch period {
	case "12m":
		mode, n = "months", 12
	case "6m":
		mode, n = "months", 6
	case "30d":
		mode, n = "days", 30
	default:
		mode, n = "days", 7
	}

	// ----- resmi departman listesi -----
	// Önce departments koleksiyonundan oku; yoksa kullanıcıların distinct( department )'ina düs.
	deps := make([]string, 0, 16)

	if depCol := db.Col("departments"); depCol != nil {
		cur, _ := depCol.Find(ctx, bson.M{})
		var docs []struct {
			Name       string `bson:"name"`
			Department string `bson:"department"`
			Title      string `bson:"title"`
		}
		_ = cur.All(ctx, &docs)
		for _, d := range docs {
			name := strings.TrimSpace(d.Name)
			if name == "" {
				name = strings.TrimSpace(d.Department)
			}
			if name == "" {
				name = strings.TrimSpace(d.Title)
			}
			if name != "" {
				deps = append(deps, name)
			}
		}
	}
	if len(deps) == 0 {
		rawDeps, _ := users.Distinct(ctx, "department", bson.M{"department": bson.M{"$ne": ""}})
		for _, v := range rawDeps {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				deps = append(deps, strings.TrimSpace(s))
			}
		}
	}
	// normalize + uniq + sort
	if len(deps) > 0 {
		m := map[string]struct{}{}
		out := make([]string, 0, len(deps))
		for _, d := range deps {
			d = strings.TrimSpace(d)
			if d == "" {
				continue
			}
			if _, seen := m[d]; !seen {
				m[d] = struct{}{}
				out = append(out, d)
			}
		}
		sort.Strings(out)
		deps = out
	}
	deptCount := int64(len(deps))

	// ----- tarih aralığı -----
	var fromStr string
	if mode == "days" {
		fromStr = time.Now().AddDate(0, 0, -(n - 1)).Format("2006-01-02")
	} else {
		now := time.Now()
		first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		fromStr = first.AddDate(0, -(n - 1), 0).Format("2006-01-02")
	}

	// ----- company stats -----
	totalEmployees, _ := users.CountDocuments(ctx, bson.M{})
	today := time.Now().Format("2006-01-02")
	reportsToday, _ := reports.CountDocuments(ctx, bson.M{"date": today})

	curAvgCompany, _ := reports.Aggregate(ctx, []bson.M{
		{"$match": bson.M{"date": bson.M{"$gte": fromStr}}},
		{"$group": bson.M{"_id": nil, "avg": bson.M{"$avg": "$hours"}}},
	})
	var avgRows []struct {
		Avg float64 `bson:"avg"`
	}
	_ = curAvgCompany.All(ctx, &avgRows)
	avgHours := 0.0
	if len(avgRows) > 0 {
		avgHours = avgRows[0].Avg
	}
	stats := companyStats{
		TotalEmployees: totalEmployees,
		ReportsToday:   reportsToday,
		Departments:    deptCount,
		AvgHours:       avgHours,
	}

	// ----- Department Overview -----
	overview := make([]deptOverview, 0, len(deps))
	for _, d := range deps {
		empCount, _ := users.CountDocuments(ctx, bson.M{"department": d})

		// Bugünün rapor sayısı (departman bazında)
		pToday := []bson.M{
			{"$match": bson.M{"date": today}},
			{"$lookup": bson.M{
				"from":         "users",
				"localField":   "userId",
				"foreignField": "_id",
				"as":           "u",
			}},
			{"$unwind": "$u"},
			{"$match": bson.M{"u.department": d}},
			{"$count": "n"},
		}
		curToday, _ := reports.Aggregate(ctx, pToday)
		var cnt []struct {
			N int64 `bson:"n"`
		}
		_ = curToday.All(ctx, &cnt)
		var rpt int64
		if len(cnt) > 0 {
			rpt = cnt[0].N
		}

		// Seçilen periyotta departman ortalama saat
		pAvgDept := []bson.M{
			{"$match": bson.M{"date": bson.M{"$gte": fromStr}}},
			{"$lookup": bson.M{
				"from":         "users",
				"localField":   "userId",
				"foreignField": "_id",
				"as":           "u",
			}},
			{"$unwind": "$u"},
			{"$match": bson.M{"u.department": d}},
			{"$group": bson.M{"_id": nil, "avg": bson.M{"$avg": "$hours"}}},
		}
		curAvgDept, _ := reports.Aggregate(ctx, pAvgDept)
		var avgDeptRows []struct {
			Avg float64 `bson:"avg"`
		}
		_ = curAvgDept.All(ctx, &avgDeptRows)
		avgDept := 0.0
		if len(avgDeptRows) > 0 {
			avgDept = avgDeptRows[0].Avg
		}

		overview = append(overview, deptOverview{
			Department:   d,
			Employees:    empCount,
			ReportsToday: rpt,
			AvgHours:     avgDept,
		})
	}

	// ----- Departments Comparison (departman x zaman) -----
	// label anahtarları & görünen etiketler
	labelKeys := make([]string, 0, n)
	labels := make([]string, 0, n)
	now := time.Now()
	if mode == "days" {
		for i := n - 1; i >= 0; i-- {
			d := now.AddDate(0, 0, -i)
			labelKeys = append(labelKeys, d.Format("2006-01-02"))
			labels = append(labels, d.Format("02 Jan"))
		}
	} else {
		base := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		for i := n - 1; i >= 0; i-- {
			d := base.AddDate(0, -i, 0)
			labelKeys = append(labelKeys, d.Format("2006-01"))
			labels = append(labels, d.Format("Jan 06"))
		}
	}

	comp := compareSeries{Labels: labels}
	for _, d := range deps {
		points := make([]float64, len(labelKeys))

		p := []bson.M{
			{"$match": bson.M{"date": bson.M{"$gte": fromStr}}},
			{"$lookup": bson.M{
				"from":         "users",
				"localField":   "userId",
				"foreignField": "_id",
				"as":           "u",
			}},
			{"$unwind": "$u"},
			{"$match": bson.M{"u.department": d}},
		}
		if mode == "days" {
			p = append(p, bson.M{"$group": bson.M{
				"_id":   "$date",
				"hours": bson.M{"$sum": "$hours"},
			}})
		} else {
			p = append(p, bson.M{"$group": bson.M{
				"_id":   bson.M{"$substr": []interface{}{"$date", 0, 7}},
				"hours": bson.M{"$sum": "$hours"},
			}})
		}
		p = append(p, bson.M{"$sort": bson.M{"_id": 1}})

		curCmp, _ := reports.Aggregate(ctx, p)
		var rows []struct {
			Key   string  `bson:"_id"`
			Hours float64 `bson:"hours"`
		}
		_ = curCmp.All(ctx, &rows)

		byKey := make(map[string]float64, len(rows))
		for _, r := range rows {
			byKey[r.Key] = r.Hours
		}
		for i, k := range labelKeys {
			points[i] = byKey[k]
		}

		comp.Series = append(comp.Series, struct {
			Department string    `json:"department"`
			Points     []float64 `json:"points"`
		}{
			Department: d,
			Points:     points,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":    stats,
		"overview": overview,
		"compare":  comp,
	})
}
