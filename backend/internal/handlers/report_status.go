package handlers

import (
	"net/http"
	"strings"

	"report-management-system/internal/db"
	"report-management-system/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GET /api/reports/status?date=YYYY-MM-DD&department=...   (admin|superadmin)
// Verilen departmandaki tüm kullanıcılar için "o gün rapor var mı?"
func GetReportStatusByDepartment(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = todayStr()
	}
	role := c.GetString("role")
	dep := strings.TrimSpace(c.Query("department"))

	if role == string(models.RoleAdmin) {
		// admin ise parametreyi zorla kendi departmanına
		uid := c.GetString("userId")
		var me models.User
		if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": toOID(uid)}).Decode(&me); err == nil {
			dep = strings.TrimSpace(me.Department)
		}
	}

	// departmandaki kullanıcıları çekiyoruz
	userFilter := bson.M{}
	if dep != "" {
		userFilter["department"] = dep
	}
	curU, err := db.Col("users").Find(c.Request.Context(), userFilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer curU.Close(c.Request.Context())

	var users []models.User
	_ = curU.All(c.Request.Context(), &users)

	ids := make([]primitive.ObjectID, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
	}

	// o gün raporu olanları çek
	reportsByUID := map[primitive.ObjectID]models.Report{}
	if len(ids) > 0 {
		curR, err := db.Col("reports").Find(c.Request.Context(), bson.M{
			"userId": bson.M{"$in": ids},
			"date":   date,
		})
		if err == nil {
			var reps []models.Report
			_ = curR.All(c.Request.Context(), &reps)
			for _, r := range reps {
				reportsByUID[r.UserID] = r
			}
		}
	}

	type Row struct {
		UserID    string  `json:"userId"`
		Name      string  `json:"name"`
		HasReport bool    `json:"hasReport"`
		Hours     float64 `json:"hours,omitempty"`
	}
	out := make([]Row, 0, len(users))
	for _, u := range users {
		if r, ok := reportsByUID[u.ID]; ok {
			out = append(out, Row{
				UserID:    u.ID.Hex(),
				Name:      u.Name,
				HasReport: true,
				Hours:     r.Hours,
			})
		} else {
			out = append(out, Row{
				UserID:    u.ID.Hex(),
				Name:      u.Name,
				HasReport: false,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"date":        date,
		"department":  dep,
		"items":       out,
		"totalUsers":  len(users),
		"withReports": len(reportsByUID),
	})
}
