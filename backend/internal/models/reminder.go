package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ReminderType string

const (
	ReminderInfo    ReminderType = "info"
	ReminderWarning ReminderType = "warning"
	ReminderSuccess ReminderType = "success"
	ReminderError   ReminderType = "error"
)

type Reminder struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Content          string             `bson:"content" json:"content"`
	Type             ReminderType       `bson:"type" json:"type"`                         // info|warning|success|error
	TargetDepartment string             `bson:"targetDepartment" json:"targetDepartment"` // "all" veya departman adı
	SenderID         primitive.ObjectID `bson:"senderId" json:"senderId"`
	SenderName       string             `bson:"senderName" json:"senderName"`
	SenderRole       Role               `bson:"senderRole" json:"senderRole"`
	Duration         string             `bson:"duration" json:"duration"` // temporary|permanent
	IsActive         bool               `bson:"isActive" json:"isActive"`
	ExpiresAt        *time.Time         `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
}
