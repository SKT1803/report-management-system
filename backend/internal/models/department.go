package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Department struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name"         json:"name"`
	Active    bool               `bson:"active"       json:"active"`
	CreatedAt time.Time          `bson:"createdAt"    json:"createdAt"`
}
