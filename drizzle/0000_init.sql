CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"initial_balance_cents" bigint DEFAULT 0 NOT NULL,
	"initial_balance_date" date NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"is_liquid" boolean DEFAULT true NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('checking', 'savings', 'cash', 'other'))
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"amount_cents" bigint NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_user_category_unique" UNIQUE NULLS NOT DISTINCT("user_id","category_id"),
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text,
	"name" text,
	"kind" text NOT NULL,
	"group" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "categories_user_key_unique" UNIQUE("user_id","key"),
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('expense', 'income')),
	CONSTRAINT "categories_group_check" CHECK ("categories"."group" in ('needs', 'lifestyle', 'other', 'income')),
	CONSTRAINT "categories_label_check" CHECK ("categories"."key" is not null or "categories"."name" is not null)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"category_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"notes" text,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"last_generated_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "recurring_type_check" CHECK ("recurring_transactions"."type" in ('expense', 'income', 'transfer')),
	CONSTRAINT "recurring_amount_check" CHECK ("recurring_transactions"."amount_cents" > 0),
	CONSTRAINT "recurring_frequency_check" CHECK ("recurring_transactions"."frequency" in ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_interval_check" CHECK ("recurring_transactions"."interval" between 1 and 12),
	CONSTRAINT "recurring_dates_check" CHECK ("recurring_transactions"."end_date" is null or "recurring_transactions"."end_date" >= "recurring_transactions"."start_date"),
	CONSTRAINT "recurring_shape_check" CHECK (("recurring_transactions"."type" = 'transfer' and "recurring_transactions"."to_account_id" is not null and "recurring_transactions"."to_account_id" <> "recurring_transactions"."account_id" and "recurring_transactions"."category_id" is null)
        or ("recurring_transactions"."type" in ('expense', 'income') and "recurring_transactions"."to_account_id" is null and "recurring_transactions"."category_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"date" date NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"category_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"notes" text,
	"recurring_id" uuid,
	"occurrence_date" date,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_recurring_occurrence_unique" UNIQUE("recurring_id","occurrence_date"),
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('expense', 'income', 'transfer')),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_cents" > 0),
	CONSTRAINT "transactions_shape_check" CHECK (("transactions"."type" = 'transfer' and "transactions"."to_account_id" is not null and "transactions"."to_account_id" <> "transactions"."account_id" and "transactions"."category_id" is null)
        or ("transactions"."type" in ('expense', 'income') and "transactions"."to_account_id" is null and "transactions"."category_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"locale" text DEFAULT 'ca' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_locale_check" CHECK ("users"."locale" in ('ca', 'es', 'en'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_to_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("to_account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_id_recurring_transactions_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("to_account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_user_idx" ON "recurring_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_to_account_idx" ON "transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");