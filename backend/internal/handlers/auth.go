package handlers

import (
	"net/http"
	"os"
	"strings"
	"time"

	"report-management-system/internal/db"
	"report-management-system/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

// GET /api/me  (JWT zorunlu)
func Me(c *gin.Context) {
	uidHex, _ := c.Get("userId")

	oid, err := primitive.ObjectIDFromHex(uidHex.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}

	var u models.User
	if err := db.Col("users").FindOne(c.Request.Context(), bson.M{"_id": oid}).Decode(&u); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         u.ID.Hex(),
		"name":       u.Name,
		"email":      u.Email,
		"role":       u.Role,
		"department": u.Department,
	})
}

// POST /api/auth/register
func Register(c *gin.Context) {
	var body struct {
		Name       string `json:"name"`
		Email      string `json:"email"`
		Password   string `json:"password"`
		Role       string `json:"role"` // optional, default: employee
		Department string `json:"department"`
	}
	if err := c.ShouldBindJSON(&body); err != nil ||
		strings.TrimSpace(body.Name) == "" ||
		strings.TrimSpace(body.Email) == "" ||
		strings.TrimSpace(body.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	dept := strings.TrimSpace(body.Department) // burada normalize yapılabilir ?

	// email var mı?
	if err := db.Col("users").
		FindOne(c.Request.Context(), bson.M{"email": email}).
		Err(); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	} else if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// şifre hashle
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash error"})
		return
	}

	// rol seçimi (default employee)
	role := models.RoleEmployee
	switch strings.ToLower(strings.TrimSpace(body.Role)) {
	case "admin":
		role = models.RoleAdmin
	case "superadmin":
		role = models.RoleSuperAdmin
	}

	u := models.User{
		Name:         strings.TrimSpace(body.Name),
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		Department:   dept,
	}

	res, err := db.Col("users").InsertOne(c.Request.Context(), u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": res.InsertedID})
}

// POST /api/auth/login
func Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil ||
		strings.TrimSpace(body.Email) == "" ||
		strings.TrimSpace(body.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))

	var u models.User
	if err := db.Col("users").
		FindOne(c.Request.Context(), bson.M{"email": email}).
		Decode(&u); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"}) // 401
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"}) // 401
		return
	}

	claims := jwt.MapClaims{
		"id":   u.ID.Hex(),
		"role": string(u.Role),
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	str, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	c.JSON(http.StatusOK, gin.H{
		"token": str,
		"user": gin.H{
			"id":         u.ID.Hex(),
			"name":       u.Name,
			"role":       u.Role,
			"email":      u.Email,
			"department": u.Department,
		},
	})
}
