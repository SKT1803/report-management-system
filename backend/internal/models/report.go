package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Report struct {
	ID     primitive.ObjectID `bson:"_id,omitempty"  json:"id"`
	UserID primitive.ObjectID `bson:"userId"         json:"userId"`

	// Denormalized fields (opsiyonel ama handler'lar bunları set ediyor)
	UserName string `bson:"userName,omitempty"         json:"userName,omitempty"`
	Role     Role   `bson:"role,omitempty"             json:"role,omitempty"`

	Date      string    `bson:"date"             json:"date"` // YYYY-MM-DD
	Content   string    `bson:"content"          json:"content"`
	Hours     float64   `bson:"hours,omitempty"   json:"hours,omitempty"`
	CreatedAt time.Time `bson:"createdAt"         json:"createdAt"`
}
