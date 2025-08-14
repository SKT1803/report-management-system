package handlers

import (
	"net/http"
	"strings"

	"report-management-system/internal/db"
	"report-management-system/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetDepartments(c *gin.Context) {
	ctx := c.Request.Context()
	role := c.GetString("role")

	if role == string(models.RoleSuperAdmin) {
		// departments koleksiyonundan aktif olanları sırala
		cur, err := db.Col("departments").Find(
			ctx,
			bson.M{"active": true},
			options.Find().
				SetProjection(bson.M{"name": 1, "_id": 0}).
				SetSort(bson.D{{Key: "name", Value: 1}}),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer cur.Close(ctx)

		type Row struct {
			Name string `bson:"name"`
		}
		out := []string{}
		for cur.Next(ctx) {
			var r Row
			_ = cur.Decode(&r)
			if d := strings.TrimSpace(r.Name); d != "" {
				out = append(out, d)
			}
		}
		c.JSON(http.StatusOK, gin.H{"departments": out})
		return
	}

	// admin / employee: sadece kendi departmanı
	uid := c.GetString("userId")
	oid, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	var u models.User
	if err := db.Col("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	dep := strings.TrimSpace(u.Department)
	if dep == "" {
		c.JSON(http.StatusOK, gin.H{"departments": []string{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"departments": []string{dep}})
}
