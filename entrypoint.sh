#!/bin/sh
set -e
echo "Syncing database schema..."
npx prisma db push --skip-generate
echo "Seeding initial data..."
npx tsx prisma/seed.ts
echo "Starting server..."
exec npm start
