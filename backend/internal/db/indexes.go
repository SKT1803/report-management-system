package db

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func EnsureReminderIndexes(ctx context.Context) error {
	col := Col("reminders")

	models := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "isActive", Value: 1},
				{Key: "targetDepartment", Value: 1},
				{Key: "expiresAt", Value: 1},
				{Key: "createdAt", Value: -1},
			},
			Options: options.Index().
				SetName("active_dept_exp_created").
				SetPartialFilterExpression(bson.M{"isActive": true}),
		},
		{
			Keys: bson.D{
				{Key: "senderId", Value: 1},
				{Key: "isActive", Value: 1},
				{Key: "expiresAt", Value: 1},
				{Key: "createdAt", Value: -1},
			},
			Options: options.Index().
				SetName("sender_active_exp_created").
				SetPartialFilterExpression(bson.M{"isActive": true}),
		},
	}

	_, err := col.Indexes().CreateMany(ctx, models)
	return err
}
