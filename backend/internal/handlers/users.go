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

// GET /api/users?department=...   (admin|superadmin)
// Admin: sadece kendi departmanı; Superadmin: parametre zorunlu değil (hepsi)
func GetUsersByDepartment(c *gin.Context) {
	role := c.GetString("role")
	dep := strings.TrimSpace(c.Query("department"))

	if role == string(models.RoleAdmin) {
		// admin'in kendi departmanını bul
		uid := c.GetString("userId")
		var me models.User
		if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": toOID(uid)}).Decode(&me); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user not found"})
			return
		}
		dep = strings.TrimSpace(me.Department)
	}

	filter := bson.M{}
	if dep != "" {
		filter["department"] = dep
	}

	cur, err := db.Col("users").Find(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(c.Request.Context())

	type UserDTO struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		Email      string `json:"email"`
		Role       string `json:"role"`
		Department string `json:"department"`
	}
	var out []UserDTO
	for cur.Next(c.Request.Context()) {
		var u models.User
		if err := cur.Decode(&u); err == nil {
			out = append(out, UserDTO{
				ID:         u.ID.Hex(),
				Name:       u.Name,
				Email:      u.Email,
				Role:       string(u.Role),
				Department: u.Department,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": out, "department": dep})
}

func toOID(hex string) primitive.ObjectID {
	oid, _ := primitive.ObjectIDFromHex(hex)
	return oid
}
