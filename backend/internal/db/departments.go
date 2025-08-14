package db

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ŞİRKETİN SABİT DEPARTMAN LİSTESİ
var BuiltInDepartments = []string{
	"Sales",
	"Engineering",
	"Marketing",
	"HR",
	"Finance",
}

func departmentsCol() *mongo.Collection { return Col("departments") }

func ensureDepartmentIndexes(ctx context.Context) error {
	_, err := departmentsCol().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetName("uniq_name").SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "active", Value: 1}},
			Options: options.Index().SetName("idx_active"),
		},
	})
	return err
}

// Tek tek isimleri upsert eder; mevcutsa dokunmaz, yoksa aktif olarak ekler.
func UpsertDepartments(ctx context.Context, names []string) (int, error) {
	if len(names) == 0 {
		return 0, nil
	}

	seen := make(map[string]struct{}, len(names))
	bulk := make([]mongo.WriteModel, 0, len(names))
	now := time.Now()

	for _, n := range names {
		name := strings.TrimSpace(n)
		if name == "" {
			continue
		}
		if _, dup := seen[name]; dup {
			continue
		}
		seen[name] = struct{}{}

		filter := bson.M{"name": name}
		update := bson.M{
			"$setOnInsert": bson.M{
				"name":      name,
				"active":    true,
				"createdAt": now,
			},
		}
		bulk = append(bulk,
			mongo.NewUpdateOneModel().
				SetFilter(filter).
				SetUpdate(update).
				SetUpsert(true),
		)
	}

	if len(bulk) == 0 {
		return 0, nil
	}
	res, err := departmentsCol().BulkWrite(ctx, bulk, options.BulkWrite().SetOrdered(false))
	if err != nil {
		return 0, err
	}
	return int(res.UpsertedCount), nil
}

// SABİT (dosya içi) listeden seed et.
func seedDepartmentsFromBuiltIn(ctx context.Context) error {
	_, err := UpsertDepartments(ctx, BuiltInDepartments)
	return err
}

// Koleksiyon boşsa, users.distinct('department') ile seed eder (fallback).
func seedDepartmentsFromUsersIfEmpty(ctx context.Context) error {
	cnt, err := departmentsCol().CountDocuments(ctx, bson.M{})
	if err != nil {
		return err
	}
	if cnt > 0 {
		return nil
	}

	vals, err := Col("users").Distinct(ctx, "department", bson.M{
		"department": bson.M{"$ne": ""},
	})
	if err != nil {
		return err
	}

	bulk := make([]mongo.WriteModel, 0, len(vals))
	now := time.Now()
	for _, v := range vals {
		name, _ := v.(string)
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		doc := bson.D{
			{Key: "name", Value: name},
			{Key: "active", Value: true},
			{Key: "createdAt", Value: now},
		}
		bulk = append(bulk, mongo.NewInsertOneModel().SetDocument(doc))
	}

	if len(bulk) == 0 {
		return nil
	}
	_, err = departmentsCol().BulkWrite(ctx, bulk)
	return err
}

// Uygulama başlangıcında çağır.
func InitDepartments(ctx context.Context) error {
	if err := ensureDepartmentIndexes(ctx); err != nil {
		return err
	}
	// Dosya içindeki sabit listeden upsert
	if err := seedDepartmentsFromBuiltIn(ctx); err != nil {
		return err
	}
	//(Hala bossa) users.distinct fallback
	if err := seedDepartmentsFromUsersIfEmpty(ctx); err != nil {
		return err
	}
	return nil
}
