package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Role string

const (
	RoleEmployee   Role = "employee"
	RoleAdmin      Role = "admin"
	RoleSuperAdmin Role = "superadmin"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name         string             `bson:"name" json:"name"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"passwordHash,omitempty" json:"-"`
	Role         Role               `bson:"role" json:"role"`
	Department   string             `bson:"department,omitempty" json:"department,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
}
