package handlers

import (
	"net/http"
	"strings"
	"time"

	"report-management-system/internal/db"
	"report-management-system/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// POST /api/reminders (admin/superadmin)

func CreateReminder(c *gin.Context) {
	role := c.GetString("role")
	if role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var body struct {
		Content          string `json:"content"`
		Type             string `json:"type"`             // info|warning|success|error
		TargetDepartment string `json:"targetDepartment"` // "all" | "<dept>"
		Duration         string `json:"duration"`         // temporary|permanent
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	// sender bilgisi
	uidHex := c.GetString("userId")
	uid, _ := primitive.ObjectIDFromHex(uidHex)

	var sender models.User
	if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": uid}).Decode(&sender); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// tür ve süreyi normalize et
	typ := strings.ToLower(strings.TrimSpace(body.Type))
	switch typ {
	case "info", "warning", "success", "error":
	default:
		typ = "info"
	}

	dur := strings.ToLower(strings.TrimSpace(body.Duration))
	if dur != "temporary" && dur != "permanent" {
		dur = "temporary"
	}

	// hedef departman kuralı:
	// - admin: sadece kendi departmanı
	// - superadmin: boşsa "all", doluysa olduğu gibi
	target := strings.TrimSpace(body.TargetDepartment)
	if role == string(models.RoleAdmin) {
		target = strings.TrimSpace(sender.Department)
		if target == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin has no department"})
			return
		}
	} else {
		// superadmin
		if target == "" {
			target = "all"
		}
	}

	// süreye göre expiresAt
	now := time.Now()
	var expires *time.Time
	if dur == "temporary" {
		t := now.Add(24 * time.Hour)
		expires = &t
	}

	rem := models.Reminder{
		Content:          strings.TrimSpace(body.Content),
		Type:             models.ReminderType(typ),
		TargetDepartment: target,
		SenderID:         sender.ID,
		SenderName:       sender.Name,
		SenderRole:       sender.Role,
		Duration:         dur,
		IsActive:         true,
		ExpiresAt:        expires,
		CreatedAt:        now,
	}

	res, err := db.Col("reminders").InsertOne(c.Request.Context(), rem)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": res.InsertedID})
}

// GET /api/reminders (JWT)
// - Çalışan/Admin: all + kendi departmanı (aktif, zamanı geçmemiş)
// - Superadmin & ?department=Sales: Sales'a (ve "all"a) gönderilen aktif mesajlar
// - Superadmin & paramsız: all + kendi departmanı

func ListMyReminders(c *gin.Context) {
	uidHex := c.GetString("userId")
	oid, _ := primitive.ObjectIDFromHex(uidHex)

	var me models.User
	if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": oid}).Decode(&me); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
		return
	}

	now := time.Now()
	expiresOk := bson.M{"$or": []bson.M{
		{"expiresAt": bson.M{"$gt": now}},
		{"expiresAt": bson.M{"$exists": false}},
	}}

	// Superadmin belirli bir departmanı görmek isterse (?department=Sales)
	dept := strings.TrimSpace(c.Query("department"))
	if me.Role == models.RoleSuperAdmin && dept != "" {
		query := bson.M{
			"$and": []bson.M{
				{"isActive": true},
				expiresOk,
				{"$or": []bson.M{
					{"targetDepartment": "all"},
					{"targetDepartment": dept},
				}},
			},
		}
		cur, err := db.Col("reminders").Find(c.Request.Context(), query, optionsFindByDateDesc())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer cur.Close(c.Request.Context())

		var list []models.Reminder
		if err := cur.All(c.Request.Context(), &list); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": list})
		return
	}

	// Varsayılan görünüm
	query := bson.M{
		"$and": []bson.M{
			{"isActive": true},
			expiresOk,
			{"$or": []bson.M{
				{"targetDepartment": "all"},
				{"targetDepartment": me.Department},
			}},
		},
	}

	cur, err := db.Col("reminders").Find(c.Request.Context(), query, optionsFindByDateDesc())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var list []models.Reminder
	if err := cur.All(c.Request.Context(), &list); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

// GET /api/reminders/sent (admin/superadmin)
//- includeInactive=1 verilmezse aktif + süresi geçmemiş

func ListSentReminders(c *gin.Context) {
	role := c.GetString("role")
	if role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	includeInactive := c.Query("includeInactive") == "1"

	uidHex := c.GetString("userId")
	oid, _ := primitive.ObjectIDFromHex(uidHex)

	filter := bson.M{"senderId": oid}
	if !includeInactive {
		now := time.Now()
		filter = bson.M{
			"senderId": oid,
			"$and": []bson.M{
				{"isActive": true},
				{"$or": []bson.M{
					{"expiresAt": bson.M{"$gt": now}},
					{"expiresAt": bson.M{"$exists": false}},
				}},
			},
		}
	}

	cur, err := db.Col("reminders").Find(c.Request.Context(), filter, optionsFindByDateDesc())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	var list []models.Reminder
	if err := cur.All(c.Request.Context(), &list); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

// DELETE /api/reminders/:id (admin kendi, superadmin herkes)

func DeleteReminder(c *gin.Context) {
	role := c.GetString("role")
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}

	var rem models.Reminder
	if err := db.Col("reminders").FindOne(c.Request.Context(), bson.M{"_id": oid}).Decode(&rem); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	uidHex := c.GetString("userId")
	uid, _ := primitive.ObjectIDFromHex(uidHex)

	// admin sadece kendi mesajını silebilir
	if role == string(models.RoleAdmin) && rem.SenderID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	_, err = db.Col("reminders").UpdateByID(c.Request.Context(), oid, bson.M{"$set": bson.M{"isActive": false}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func optionsFindByDateDesc() *options.FindOptions {
	return options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
}
