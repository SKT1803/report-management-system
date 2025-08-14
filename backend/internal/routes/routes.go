package routes

import (
	"report-management-system/internal/handlers"
	"report-management-system/internal/middleware"

	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/health", handlers.Health)

		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}

		api.GET("/me", middleware.JWT(), handlers.Me)

		// --- REPORTS ---
		reports := api.Group("/reports", middleware.JWT())
		{
			reports.POST("", handlers.CreateOrUpdateMyReport)
			reports.GET("/me/today", handlers.GetMyTodayReport)
			reports.GET("/me/history", handlers.GetMyReportsHistory)

			reports.GET("/today", middleware.RequireRole("admin", "superadmin"), handlers.GetReportsByDay)
			reports.GET("/search", middleware.RequireRole("admin", "superadmin"), handlers.SearchReports)
			reports.GET("/status", middleware.RequireRole("admin", "superadmin"), handlers.GetReportStatus)

			reports.GET("/department/series", handlers.GetDepartmentSeries)
			reports.GET("/department/breakdown", handlers.GetDepartmentBreakdown)

			reports.GET("/user/:id", middleware.RequireRole("admin", "superadmin"), handlers.GetUserReports)
		}

		// --- REMINDERS ---
		rem := api.Group("/reminders", middleware.JWT())
		{
			rem.GET("", handlers.ListMyReminders) // herkes
			rem.GET("/sent", middleware.RequireRole("admin", "superadmin"), handlers.ListSentReminders)
			rem.POST("", middleware.RequireRole("admin", "superadmin"), handlers.CreateReminder)
			rem.DELETE("/:id", middleware.RequireRole("admin", "superadmin"), handlers.DeleteReminder)
		}

		// --- DEPARTMENTS ---
		api.GET(
			"/departments",
			middleware.JWT(),
			middleware.RequireRole("admin", "superadmin"),
			handlers.GetDepartments,
		)

		// --- ANALYTICS (Company Overview) ---
		analytics := api.Group("/analytics",
			middleware.JWT(),
			middleware.RequireRole("superadmin"),
		)
		{
			analytics.GET("/company", handlers.CompanyAnalytics)
		}
	}
}
