// package db

// import (
// 	"context"
// 	"net/url"
// 	"strings"
// 	"time"

// 	"go.mongodb.org/mongo-driver/bson"
// 	"go.mongodb.org/mongo-driver/mongo"
// 	"go.mongodb.org/mongo-driver/mongo/options"
// )

// var client *mongo.Client
// var database *mongo.Database
// var dbName string

// func Connect(uri string) error {
// 	c, err := mongo.NewClient(options.Client().ApplyURI(uri))
// 	if err != nil {
// 		return err
// 	}
// 	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
// 	defer cancel()
// 	if err = c.Connect(ctx); err != nil {
// 		return err
// 	}
// 	client = c

// 	u, _ := url.Parse(uri)
// 	path := strings.TrimPrefix(u.Path, "/")
// 	if i := strings.Index(path, "?"); i >= 0 {
// 		path = path[:i]
// 	}
// 	dbName = path

// 	if dbName != "" {
// 		database = client.Database(dbName)
// 	}
// 	return nil
// }

// func Disconnect() {
// 	if client != nil {
// 		_ = client.Disconnect(context.Background())
// 	}
// }

// func Col(name string) *mongo.Collection {
// 	if database == nil {
// 		return nil
// 	}
// 	return database.Collection(name)
// }

// func DBName() string {
// 	return dbName
// }

// func EnsureIndexes(ctx context.Context) error {
// 	if database == nil {
// 		return nil
// 	}

// 	// ----- users -----
// 	users := database.Collection("users")
// 	if _, err := users.Indexes().CreateMany(ctx, []mongo.IndexModel{
// 		{
// 			Keys:    bson.D{{Key: "email", Value: 1}},
// 			Options: options.Index().SetUnique(true).SetName("uniq_email"),
// 		},
// 		{
// 			Keys:    bson.D{{Key: "department", Value: 1}},
// 			Options: options.Index().SetName("idx_department"),
// 		},
// 	}); err != nil {
// 		return err
// 	}

// 	// ----- reports -----
// 	reports := database.Collection("reports")
// 	if _, err := reports.Indexes().CreateMany(ctx, []mongo.IndexModel{
// 		{
// 			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}},
// 			Options: options.Index().SetUnique(true).SetName("uniq_user_day"),
// 		},
// 		{
// 			Keys:    bson.D{{Key: "date", Value: 1}},
// 			Options: options.Index().SetName("idx_date"),
// 		},
// 		{
// 			Keys:    bson.D{{Key: "content", Value: "text"}},
// 			Options: options.Index().SetName("txt_content"),
// 		},
// 	}); err != nil {
// 		return err
// 	}

// 	// ----- reminders (simple indexes kept for compatibility) -----
// 	reminders := database.Collection("reminders")
// 	_, _ = reminders.Indexes().CreateMany(ctx, []mongo.IndexModel{
// 		{
// 			Keys:    bson.D{{Key: "targetDepartment", Value: 1}},
// 			Options: options.Index().SetName("idx_targetDepartment"),
// 		},
// 		{
// 			Keys:    bson.D{{Key: "isActive", Value: 1}},
// 			Options: options.Index().SetName("idx_isActive"),
// 		},
// 		{
// 			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
// 			Options: options.Index().SetName("idx_expiresAt"),
// 		},
// 	})

// 	// Compound + partial indexes for fast panels (?)
// 	if err := EnsureReminderIndexes(ctx); err != nil {
// 		return err
// 	}

// 	return nil
// }

package db

import (
	"context"
	"net/url"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var client *mongo.Client
var database *mongo.Database
var dbName string

func Connect(uri string) error {

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	c, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return err
	}

	// Bağlantıyı doğrulayalım
	if err := c.Ping(ctx, nil); err != nil {
		_ = c.Disconnect(context.Background())
		return err
	}
	client = c

	// URI'dan db adını çıkar
	if u, err := url.Parse(uri); err == nil {
		path := strings.TrimPrefix(u.Path, "/")
		if i := strings.Index(path, "?"); i >= 0 {
			path = path[:i]
		}
		dbName = path
	} else {
		dbName = ""
	}

	// Varsayılan DB'yi ayarla (varsa)
	if dbName != "" {
		database = client.Database(dbName)
	} else {
		database = nil
	}
	return nil
}

func Disconnect() {
	if client != nil {
		_ = client.Disconnect(context.Background())
	}
}

func Col(name string) *mongo.Collection {
	if database == nil {
		return nil
	}
	return database.Collection(name)
}

func DBName() string {
	return dbName
}

func EnsureIndexes(ctx context.Context) error {
	if database == nil {
		return nil
	}

	// ----- users -----
	users := database.Collection("users")
	if _, err := users.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("uniq_email"),
		},
		{
			Keys:    bson.D{{Key: "department", Value: 1}},
			Options: options.Index().SetName("idx_department"),
		},
	}); err != nil {
		return err
	}

	// ----- reports -----
	reports := database.Collection("reports")
	if _, err := reports.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("uniq_user_day"),
		},
		{
			Keys:    bson.D{{Key: "date", Value: 1}},
			Options: options.Index().SetName("idx_date"),
		},
		{
			Keys:    bson.D{{Key: "content", Value: "text"}},
			Options: options.Index().SetName("txt_content"),
		},
	}); err != nil {
		return err
	}

	// ----- reminders -----
	reminders := database.Collection("reminders")
	_, _ = reminders.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "targetDepartment", Value: 1}},
			Options: options.Index().SetName("idx_targetDepartment"),
		},
		{
			Keys:    bson.D{{Key: "isActive", Value: 1}},
			Options: options.Index().SetName("idx_isActive"),
		},
		{
			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
			Options: options.Index().SetName("idx_expiresAt"),
		},
	})

	// Panel indexleri
	if err := EnsureReminderIndexes(ctx); err != nil {
		return err
	}

	return nil
}
