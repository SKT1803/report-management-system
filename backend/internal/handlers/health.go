package handlers

import (
	"report-management-system/internal/db"

	"github.com/gin-gonic/gin"
)

func Health(c *gin.Context) {
	connected := db.DBName() != ""
	c.JSON(200, gin.H{
		"ok":          true,
		"dbConnected": connected,
		"db":          db.DBName(),
	})
}
