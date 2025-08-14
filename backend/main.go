// package main

// import (
// 	"context"
// 	"log"
// 	"os"
// 	"time"

// 	"github.com/gin-contrib/cors"
// 	"github.com/gin-gonic/gin"
// 	"github.com/joho/godotenv"

// 	"report-management-system/internal/db"
// 	"report-management-system/internal/routes"
// )

// func main() {
// 	_ = godotenv.Load()

// 	// Gin + CORS
// 	r := gin.Default()
// 	r.Use(cors.New(cors.Config{
// 		AllowOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
// 		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
// 		AllowHeaders:     []string{"Content-Type", "Authorization"},
// 		ExposeHeaders:    []string{"Content-Length"},
// 		AllowCredentials: false,
// 		MaxAge:           12 * time.Hour,
// 	}))

// 	// Mongo bağlantısı
// 	if err := db.Connect(os.Getenv("MONGO_URI")); err != nil {
// 		log.Fatal(err)
// 	}
// 	defer db.Disconnect()

// 	ctx := context.Background()

// 	if err := db.EnsureIndexes(ctx); err != nil {
// 		log.Fatal(err)
// 	}

// 	if err := db.EnsureReminderIndexes(ctx); err != nil {
// 		log.Fatal(err)
// 	}

// 	// Departments koleksiyonu: index + (boşsa) seed
// 	if err := db.InitDepartments(ctx); err != nil {
// 		log.Fatal(err)
// 	}

// 	// Departments koleksiyonu: index + (boşsa) seed
// 	if err := db.InitDepartments(ctx); err != nil {
// 		log.Fatal(err)
// 	}

// 	// Rotalar
// 	routes.Register(r)

// 	// Sunucu
// 	port := os.Getenv("PORT")
// 	if port == "" {
// 		port = "5000"
// 	}
// 	log.Println("API listening on :" + port)
// 	if err := r.Run(":" + port); err != nil {
// 		log.Fatal(err)
// 	}
// }

package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"report-management-system/internal/db"
	"report-management-system/internal/routes"
)

func main() {
	// Load .env if present (no-op in prod)
	_ = godotenv.Load()

	// --- CORS ---
	clientURL := strings.TrimSpace(os.Getenv("CLIENT_URL"))
	allowOrigins := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	}
	if clientURL != "" {
		allowOrigins = append(allowOrigins, clientURL)
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// --- MongoDB ---
	if err := db.Connect(os.Getenv("MONGO_URI")); err != nil {
		log.Fatal(err)
	}
	defer db.Disconnect()

	ctx := context.Background()

	if err := db.EnsureIndexes(ctx); err != nil {
		log.Fatal(err)
	}
	if err := db.EnsureReminderIndexes(ctx); err != nil {
		log.Fatal(err)
	}
	// Departments: index + seed if empty
	if err := db.InitDepartments(ctx); err != nil {
		log.Fatal(err)
	}

	// --- Routes ---
	routes.Register(r)

	// --- Server ---
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "5000"
	}
	log.Println("API listening on :" + port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
