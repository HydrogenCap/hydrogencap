export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounting_exports: {
        Row: {
          accounting_system: string
          entity_id: string | null
          export_type: string
          file_format: string
          file_name: string | null
          file_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          notes: string | null
          org_id: string | null
          period_from: string
          period_to: string
          row_count: number | null
          total_expenses: number | null
          total_income: number | null
        }
        Insert: {
          accounting_system: string
          entity_id?: string | null
          export_type: string
          file_format: string
          file_name?: string | null
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          period_from: string
          period_to: string
          row_count?: number | null
          total_expenses?: number | null
          total_income?: number | null
        }
        Update: {
          accounting_system?: string
          entity_id?: string | null
          export_type?: string
          file_format?: string
          file_name?: string | null
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          period_from?: string
          period_to?: string
          row_count?: number | null
          total_expenses?: number | null
          total_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_exports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "accounting_exports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_mappings: {
        Row: {
          account_code: string
          account_name: string
          accounting_system: string
          created_at: string | null
          description: string | null
          entity_id: string | null
          hydrogencap_category: string
          id: string
          is_active: boolean | null
          org_id: string | null
          tax_rate_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_code: string
          account_name: string
          accounting_system: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          hydrogencap_category: string
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          tax_rate_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string
          accounting_system?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          hydrogencap_category?: string
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          tax_rate_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "accounting_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          body: string | null
          created_at: string
          entry_type: string
          id: string
          metadata: Json | null
          org_id: string
          property_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entry_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          property_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          property_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extraction_templates: {
        Row: {
          classification_keywords: string[]
          created_at: string | null
          default_validity_months: number | null
          display_name: string
          document_type: string
          extraction_fields: Json
          has_expiry: boolean | null
          id: string
          typical_issuers: string[] | null
        }
        Insert: {
          classification_keywords?: string[]
          created_at?: string | null
          default_validity_months?: number | null
          display_name: string
          document_type: string
          extraction_fields: Json
          has_expiry?: boolean | null
          id?: string
          typical_issuers?: string[] | null
        }
        Update: {
          classification_keywords?: string[]
          created_at?: string | null
          default_validity_months?: number | null
          display_name?: string
          document_type?: string
          extraction_fields?: Json
          has_expiry?: boolean | null
          id?: string
          typical_issuers?: string[] | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          org_id: string
          setting_key: string
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          org_id: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          org_id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          context: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          record_id: string
          session_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          context?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id: string
          session_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          context?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id?: string
          session_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          bank_name: string
          created_at: string | null
          currency: string | null
          entity_id: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          notes: string | null
          org_id: string
          sort_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          bank_name: string
          created_at?: string | null
          currency?: string | null
          entity_id: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          org_id: string
          sort_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          bank_name?: string
          created_at?: string | null
          currency?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          org_id?: string
          sort_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "bank_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          category: string | null
          created_at: string | null
          description: string
          id: string
          import_batch_id: string | null
          import_hash: string | null
          import_source: string | null
          is_duplicate: boolean | null
          is_reconciled: boolean | null
          matched_at: string | null
          matched_by: string | null
          matched_payment_id: string | null
          matched_schedule_id: string | null
          org_id: string
          reference: string | null
          status: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_batch_id?: string | null
          import_hash?: string | null
          import_source?: string | null
          is_duplicate?: boolean | null
          is_reconciled?: boolean | null
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_id?: string | null
          matched_schedule_id?: string | null
          org_id: string
          reference?: string | null
          status?: string
          transaction_date: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_batch_id?: string | null
          import_hash?: string | null
          import_source?: string | null
          is_duplicate?: boolean | null
          is_reconciled?: boolean | null
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_id?: string | null
          matched_schedule_id?: string | null
          org_id?: string
          reference?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_schedule_id_fkey"
            columns: ["matched_schedule_id"]
            isOneToOne: false
            referencedRelation: "rent_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficial_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficial_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capex_line_items: {
        Row: {
          actual_gbp: number
          budget_gbp: number
          category: string
          created_at: string
          description: string
          id: string
          invoice_ref: string | null
          notes: string | null
          paid_date: string | null
          project_id: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          actual_gbp?: number
          budget_gbp?: number
          category: string
          created_at?: string
          description: string
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          paid_date?: string | null
          project_id: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          actual_gbp?: number
          budget_gbp?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          paid_date?: string | null
          project_id?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capex_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "capex_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      capex_projects: {
        Row: {
          actual_end_date: string | null
          actual_gbp: number
          budget_gbp: number
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          property_id: string
          start_date: string | null
          status: string
          target_end_date: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_gbp?: number
          budget_gbp?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          property_id: string
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_gbp?: number
          budget_gbp?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          property_id?: string
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capex_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capex_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_type_mappings: {
        Row: {
          ai_detected_type: string
          compliance_type: string
          created_at: string
          document_category: string
          has_expiry: boolean | null
          id: string
          keywords: string[] | null
          typical_validity_years: number | null
        }
        Insert: {
          ai_detected_type: string
          compliance_type: string
          created_at?: string
          document_category: string
          has_expiry?: boolean | null
          id?: string
          keywords?: string[] | null
          typical_validity_years?: number | null
        }
        Update: {
          ai_detected_type?: string
          compliance_type?: string
          created_at?: string
          document_category?: string
          has_expiry?: boolean | null
          id?: string
          keywords?: string[] | null
          typical_validity_years?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          accounts_due_date: string | null
          accounts_last_filed_date: string | null
          accounts_period_end: string | null
          ch_incorporation_date: string | null
          ch_last_synced_at: string | null
          ch_registered_address: string | null
          company_number: string | null
          company_type: string
          confirmation_statement_due_date: string | null
          confirmation_statement_last_filed_date: string | null
          confirmation_statement_last_made_up_to: string | null
          created_at: string
          id: string
          jurisdiction: string | null
          legal_name: string
          org_id: string
          party_id: string
          status: string
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          accounts_due_date?: string | null
          accounts_last_filed_date?: string | null
          accounts_period_end?: string | null
          ch_incorporation_date?: string | null
          ch_last_synced_at?: string | null
          ch_registered_address?: string | null
          company_number?: string | null
          company_type?: string
          confirmation_statement_due_date?: string | null
          confirmation_statement_last_filed_date?: string | null
          confirmation_statement_last_made_up_to?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          legal_name: string
          org_id: string
          party_id: string
          status?: string
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          accounts_due_date?: string | null
          accounts_last_filed_date?: string | null
          accounts_period_end?: string | null
          ch_incorporation_date?: string | null
          ch_last_synced_at?: string | null
          ch_registered_address?: string | null
          company_number?: string | null
          company_type?: string
          confirmation_statement_due_date?: string | null
          confirmation_statement_last_filed_date?: string | null
          confirmation_statement_last_made_up_to?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          legal_name?: string
          org_id?: string
          party_id?: string
          status?: string
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      companies_house_cache: {
        Row: {
          company_number: string
          created_at: string | null
          data_type: string
          entity_id: string
          expires_at: string
          fetched_at: string
          id: string
          response_data: Json
        }
        Insert: {
          company_number: string
          created_at?: string | null
          data_type: string
          entity_id: string
          expires_at?: string
          fetched_at?: string
          id?: string
          response_data: Json
        }
        Update: {
          company_number?: string
          created_at?: string | null
          data_type?: string
          entity_id?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          response_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "companies_house_cache_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "companies_house_cache_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      companies_house_sync_log: {
        Row: {
          changes_detected: Json | null
          company_number: string
          entity_id: string
          error_message: string | null
          id: string
          status: string
          sync_type: string
          synced_at: string | null
        }
        Insert: {
          changes_detected?: Json | null
          company_number: string
          entity_id: string
          error_message?: string | null
          id?: string
          status: string
          sync_type: string
          synced_at?: string | null
        }
        Update: {
          changes_detected?: Json | null
          company_number?: string
          entity_id?: string
          error_message?: string | null
          id?: string
          status?: string
          sync_type?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_house_sync_log_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "companies_house_sync_log_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      company_metric_snapshots: {
        Row: {
          as_of_date: string
          cashflow_monthly: number | null
          company_id: string
          created_at: string
          debt: number | null
          equity: number | null
          id: string
          valuation: number | null
        }
        Insert: {
          as_of_date: string
          cashflow_monthly?: number | null
          company_id: string
          created_at?: string
          debt?: number | null
          equity?: number | null
          id?: string
          valuation?: number | null
        }
        Update: {
          as_of_date?: string
          cashflow_monthly?: number | null
          company_id?: string
          created_at?: string
          debt?: number | null
          equity?: number | null
          id?: string
          valuation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_metric_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_secrets: {
        Row: {
          auth_code_encrypted: string | null
          auth_code_last4: string | null
          company_id: string
          updated_at: string
          updated_by: string | null
          utr_encrypted: string | null
          utr_last4: string | null
        }
        Insert: {
          auth_code_encrypted?: string | null
          auth_code_last4?: string | null
          company_id: string
          updated_at?: string
          updated_by?: string | null
          utr_encrypted?: string | null
          utr_last4?: string | null
        }
        Update: {
          auth_code_encrypted?: string | null
          auth_code_last4?: string | null
          company_id?: string
          updated_at?: string
          updated_by?: string | null
          utr_encrypted?: string | null
          utr_last4?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_sales: {
        Row: {
          address: string
          created_at: string
          distance_meters: number | null
          id: string
          latitude: number | null
          longitude: number | null
          new_build: boolean | null
          org_id: string
          postcode: string
          price_paid: number
          property_type: string | null
          sale_date: string
          source_property_id: string | null
          tenure: string | null
          transaction_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_build?: boolean | null
          org_id: string
          postcode: string
          price_paid: number
          property_type?: string | null
          sale_date: string
          source_property_id?: string | null
          tenure?: string | null
          transaction_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_build?: boolean | null
          org_id?: string
          postcode?: string
          price_paid?: number
          property_type?: string | null
          sale_date?: string
          source_property_id?: string | null
          tenure?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparable_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparable_sales_source_property_id_fkey"
            columns: ["source_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_contractors_v2: {
        Row: {
          company_name: string
          contact_name: string | null
          coverage_area: string | null
          created_at: string | null
          email: string | null
          gas_safe_number: string | null
          id: string
          is_preferred: boolean | null
          niceic_number: string | null
          notes: string | null
          org_id: string
          phone: string | null
          rating: number | null
          service_types: string[]
          updated_at: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          coverage_area?: string | null
          created_at?: string | null
          email?: string | null
          gas_safe_number?: string | null
          id?: string
          is_preferred?: boolean | null
          niceic_number?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          rating?: number | null
          service_types?: string[]
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          coverage_area?: string | null
          created_at?: string | null
          email?: string | null
          gas_safe_number?: string | null
          id?: string
          is_preferred?: boolean | null
          niceic_number?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          rating?: number | null
          service_types?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_contractors_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_documents: {
        Row: {
          archived_at: string | null
          compliance_item_id: string
          file_type: string | null
          file_url: string
          id: string
          is_current: boolean | null
          notes: string | null
          original_file_name: string
          uploaded_at: string
          uploaded_by: string | null
          version_number: number | null
        }
        Insert: {
          archived_at?: string | null
          compliance_item_id: string
          file_type?: string | null
          file_url: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          original_file_name: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: number | null
        }
        Update: {
          archived_at?: string | null
          compliance_item_id?: string
          file_type?: string | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          original_file_name?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_compliance_item_id_fkey"
            columns: ["compliance_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_documents_v2: {
        Row: {
          ai_confidence_score: number | null
          ai_extracted: boolean | null
          certificate_number: string | null
          contractor_id: string | null
          cost: number | null
          created_at: string | null
          document_type: string
          expiry_date: string | null
          file_hash: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_current: boolean | null
          issue_date: string
          issuer_name: string | null
          next_review_date: string | null
          notes: string | null
          org_id: string
          property_id: string
          status: string
          supersedes_id: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_extracted?: boolean | null
          certificate_number?: string | null
          contractor_id?: string | null
          cost?: number | null
          created_at?: string | null
          document_type: string
          expiry_date?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_current?: boolean | null
          issue_date: string
          issuer_name?: string | null
          next_review_date?: string | null
          notes?: string | null
          org_id: string
          property_id: string
          status?: string
          supersedes_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_extracted?: boolean | null
          certificate_number?: string | null
          contractor_id?: string | null
          cost?: number | null
          created_at?: string | null
          document_type?: string
          expiry_date?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_current?: boolean | null
          issue_date?: string
          issuer_name?: string | null
          next_review_date?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string
          status?: string
          supersedes_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_v2_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "compliance_documents_v2_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_v2_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "compliance_matrix_v2"
            referencedColumns: ["document_id"]
          },
        ]
      }
      compliance_items: {
        Row: {
          auto_job_created: boolean | null
          auto_job_id: string | null
          compliance_type: string
          created_at: string
          exclusion_reason: string | null
          expiry_date: string | null
          id: string
          is_coho_required: boolean | null
          is_manually_excluded: boolean | null
          is_required: boolean | null
          issue_date: string | null
          last_reminder_sent_at: string | null
          notes: string | null
          org_id: string
          property_id: string
          reminder_count: number | null
          reminder_days: number[] | null
          renewal_booked_date: string | null
          renewal_contractor_id: string | null
          renewal_notes: string | null
          renewal_status: string | null
          responsible_party: string | null
          updated_at: string
        }
        Insert: {
          auto_job_created?: boolean | null
          auto_job_id?: string | null
          compliance_type: string
          created_at?: string
          exclusion_reason?: string | null
          expiry_date?: string | null
          id?: string
          is_coho_required?: boolean | null
          is_manually_excluded?: boolean | null
          is_required?: boolean | null
          issue_date?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          org_id: string
          property_id: string
          reminder_count?: number | null
          reminder_days?: number[] | null
          renewal_booked_date?: string | null
          renewal_contractor_id?: string | null
          renewal_notes?: string | null
          renewal_status?: string | null
          responsible_party?: string | null
          updated_at?: string
        }
        Update: {
          auto_job_created?: boolean | null
          auto_job_id?: string | null
          compliance_type?: string
          created_at?: string
          exclusion_reason?: string | null
          expiry_date?: string | null
          id?: string
          is_coho_required?: boolean | null
          is_manually_excluded?: boolean | null
          is_required?: boolean | null
          issue_date?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string
          reminder_count?: number | null
          reminder_days?: number[] | null
          renewal_booked_date?: string | null
          renewal_contractor_id?: string | null
          renewal_notes?: string | null
          renewal_status?: string | null
          responsible_party?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_auto_job_id_fkey"
            columns: ["auto_job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_renewal_contractor_id_fkey"
            columns: ["renewal_contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_notifications: {
        Row: {
          channel: string
          compliance_task_id: string | null
          document_type: string | null
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          org_id: string
          property_id: string | null
          read_at: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          channel?: string
          compliance_task_id?: string | null
          document_type?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          org_id: string
          property_id?: string | null
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          channel?: string
          compliance_task_id?: string | null
          document_type?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          org_id?: string
          property_id?: string | null
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notifications_compliance_task_id_fkey"
            columns: ["compliance_task_id"]
            isOneToOne: false
            referencedRelation: "compliance_task_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "compliance_notifications_compliance_task_id_fkey"
            columns: ["compliance_task_id"]
            isOneToOne: false
            referencedRelation: "compliance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_requirements_v2: {
        Row: {
          created_at: string | null
          document_type: string
          id: string
          is_required: boolean | null
          lead_time_days: number | null
          notes: string | null
          org_id: string
          override_reason: string | null
          property_id: string
          requirement_reason: string | null
          review_frequency_months: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          id?: string
          is_required?: boolean | null
          lead_time_days?: number | null
          notes?: string | null
          org_id: string
          override_reason?: string | null
          property_id: string
          requirement_reason?: string | null
          review_frequency_months?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          id?: string
          is_required?: boolean | null
          lead_time_days?: number | null
          notes?: string | null
          org_id?: string
          override_reason?: string | null
          property_id?: string
          requirement_reason?: string | null
          review_frequency_months?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_tasks: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          compliance_document_id: string | null
          compliance_requirement_id: string | null
          contractor_booked_date: string | null
          contractor_id: string | null
          created_at: string | null
          description: string | null
          document_type: string
          due_date: string | null
          escalation_level: number | null
          id: string
          inspection_date: string | null
          last_escalated_at: string | null
          notes: string | null
          org_id: string
          priority: string
          property_id: string
          quoted_cost: number | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string | null
          status: string
          task_type: string
          title: string
          trigger_date: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          compliance_document_id?: string | null
          compliance_requirement_id?: string | null
          contractor_booked_date?: string | null
          contractor_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type: string
          due_date?: string | null
          escalation_level?: number | null
          id?: string
          inspection_date?: string | null
          last_escalated_at?: string | null
          notes?: string | null
          org_id: string
          priority?: string
          property_id: string
          quoted_cost?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          status?: string
          task_type: string
          title: string
          trigger_date?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          compliance_document_id?: string | null
          compliance_requirement_id?: string | null
          contractor_booked_date?: string | null
          contractor_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type?: string
          due_date?: string | null
          escalation_level?: number | null
          id?: string
          inspection_date?: string | null
          last_escalated_at?: string | null
          notes?: string | null
          org_id?: string
          priority?: string
          property_id?: string
          quoted_cost?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          status?: string
          task_type?: string
          title?: string
          trigger_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_matrix_v2"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "compliance_tasks_compliance_requirement_id_fkey"
            columns: ["compliance_requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_matrix_v2"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "compliance_tasks_compliance_requirement_id_fkey"
            columns: ["compliance_requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "compliance_contractors_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_maintenance_performance"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "compliance_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_templates: {
        Row: {
          applies_when: Json
          category: string
          default_frequency_months: number | null
          default_lead_time_days: number | null
          description: string | null
          display_name: string
          document_type: string
          id: string
          is_active: boolean | null
          legislation_reference: string | null
          sort_order: number | null
        }
        Insert: {
          applies_when?: Json
          category: string
          default_frequency_months?: number | null
          default_lead_time_days?: number | null
          description?: string | null
          display_name: string
          document_type: string
          id?: string
          is_active?: boolean | null
          legislation_reference?: string | null
          sort_order?: number | null
        }
        Update: {
          applies_when?: Json
          category?: string
          default_frequency_months?: number | null
          default_lead_time_days?: number | null
          description?: string | null
          display_name?: string
          document_type?: string
          id?: string
          is_active?: boolean | null
          legislation_reference?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      contractor_jobs: {
        Row: {
          accepted_at: string | null
          auto_created_at: string | null
          booked_date: string | null
          booked_time_slot: string | null
          certificate_document_id: string | null
          certificate_received: boolean | null
          certificate_received_at: string | null
          certificate_reminder_count: number | null
          certificate_reminder_sent_at: string | null
          completed_at: string | null
          compliance_item_id: string | null
          contractor_id: string | null
          contractor_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          final_amount_gbp: number | null
          follow_up_count: number | null
          id: string
          inbox_email: string | null
          inbox_email_token: string | null
          internal_notes: string | null
          invoice_reference: string | null
          job_type: string
          last_follow_up_at: string | null
          next_follow_up_date: string | null
          org_id: string
          payment_status: string | null
          priority: string | null
          property_id: string | null
          property_v2_id: string | null
          quoted_amount_gbp: number | null
          quoted_at: string | null
          request_message: string | null
          requested_at: string | null
          response_deadline: string | null
          source: string | null
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          auto_created_at?: string | null
          booked_date?: string | null
          booked_time_slot?: string | null
          certificate_document_id?: string | null
          certificate_received?: boolean | null
          certificate_received_at?: string | null
          certificate_reminder_count?: number | null
          certificate_reminder_sent_at?: string | null
          completed_at?: string | null
          compliance_item_id?: string | null
          contractor_id?: string | null
          contractor_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          final_amount_gbp?: number | null
          follow_up_count?: number | null
          id?: string
          inbox_email?: string | null
          inbox_email_token?: string | null
          internal_notes?: string | null
          invoice_reference?: string | null
          job_type: string
          last_follow_up_at?: string | null
          next_follow_up_date?: string | null
          org_id: string
          payment_status?: string | null
          priority?: string | null
          property_id?: string | null
          property_v2_id?: string | null
          quoted_amount_gbp?: number | null
          quoted_at?: string | null
          request_message?: string | null
          requested_at?: string | null
          response_deadline?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          auto_created_at?: string | null
          booked_date?: string | null
          booked_time_slot?: string | null
          certificate_document_id?: string | null
          certificate_received?: boolean | null
          certificate_received_at?: string | null
          certificate_reminder_count?: number | null
          certificate_reminder_sent_at?: string | null
          completed_at?: string | null
          compliance_item_id?: string | null
          contractor_id?: string | null
          contractor_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          final_amount_gbp?: number | null
          follow_up_count?: number | null
          id?: string
          inbox_email?: string | null
          inbox_email_token?: string | null
          internal_notes?: string | null
          invoice_reference?: string | null
          job_type?: string
          last_follow_up_at?: string | null
          next_follow_up_date?: string | null
          org_id?: string
          payment_status?: string | null
          priority?: string | null
          property_id?: string | null
          property_v2_id?: string | null
          quoted_amount_gbp?: number | null
          quoted_at?: string | null
          request_message?: string | null
          requested_at?: string | null
          response_deadline?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_jobs_certificate_document_id_fkey"
            columns: ["certificate_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_compliance_item_id_fkey"
            columns: ["compliance_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_property_v2_id_fkey"
            columns: ["property_v2_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_jobs_property_v2_id_fkey"
            columns: ["property_v2_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "contractor_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_reviews: {
        Row: {
          communication_rating: number | null
          contractor_id: string
          created_at: string
          id: string
          job_id: string | null
          org_id: string
          punctuality_rating: number | null
          quality_rating: number | null
          rating: number
          review_text: string | null
          reviewed_by: string | null
          value_rating: number | null
        }
        Insert: {
          communication_rating?: number | null
          contractor_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          org_id: string
          punctuality_rating?: number | null
          quality_rating?: number | null
          rating: number
          review_text?: string | null
          reviewed_by?: string | null
          value_rating?: number | null
        }
        Update: {
          communication_rating?: number | null
          contractor_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          org_id?: string
          punctuality_rating?: number | null
          quality_rating?: number | null
          rating?: number
          review_text?: string | null
          reviewed_by?: string | null
          value_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_reviews_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_service_areas: {
        Row: {
          city: string | null
          contractor_id: string
          county: string | null
          id: string
          postcode_district: string | null
          postcode_prefix: string | null
          priority: number | null
        }
        Insert: {
          city?: string | null
          contractor_id: string
          county?: string | null
          id?: string
          postcode_district?: string | null
          postcode_prefix?: string | null
          priority?: number | null
        }
        Update: {
          city?: string | null
          contractor_id?: string
          county?: string | null
          id?: string
          postcode_district?: string | null
          postcode_prefix?: string | null
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_service_areas_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          availability_notes: string | null
          average_rating: number | null
          avg_response_hours: number | null
          call_out_fee_gbp: number | null
          company_name: string | null
          compliance_types: string[]
          created_at: string
          email: string | null
          hourly_rate_gbp: number | null
          id: string
          is_active: boolean | null
          is_preferred: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          service_areas: string[] | null
          total_jobs: number | null
          typical_costs: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          availability_notes?: string | null
          average_rating?: number | null
          avg_response_hours?: number | null
          call_out_fee_gbp?: number | null
          company_name?: string | null
          compliance_types?: string[]
          created_at?: string
          email?: string | null
          hourly_rate_gbp?: number | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          service_areas?: string[] | null
          total_jobs?: number | null
          typical_costs?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          availability_notes?: string | null
          average_rating?: number | null
          avg_response_hours?: number | null
          call_out_fee_gbp?: number | null
          company_name?: string | null
          compliance_types?: string[]
          created_at?: string
          email?: string | null
          hourly_rate_gbp?: number | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          service_areas?: string[] | null
          total_jobs?: number | null
          typical_costs?: Json | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          bills_gbp_manual: number | null
          compliance_gbp_manual: number | null
          created_at: string
          id: string
          insurance_gbp_calculated: number | null
          insurance_gbp_manual: number | null
          insurance_rule_enabled: boolean | null
          insurance_rule_percent_of_value: number | null
          management_gbp_calculated: number | null
          management_gbp_manual: number | null
          management_rule_enabled: boolean | null
          management_rule_percent_of_rent: number | null
          other_gbp_manual: number | null
          property_id: string
          repairs_gbp_calculated: number | null
          repairs_gbp_manual: number | null
          repairs_rule_enabled: boolean | null
          repairs_rule_percent_of_rent: number | null
          updated_at: string
          year: number
        }
        Insert: {
          bills_gbp_manual?: number | null
          compliance_gbp_manual?: number | null
          created_at?: string
          id?: string
          insurance_gbp_calculated?: number | null
          insurance_gbp_manual?: number | null
          insurance_rule_enabled?: boolean | null
          insurance_rule_percent_of_value?: number | null
          management_gbp_calculated?: number | null
          management_gbp_manual?: number | null
          management_rule_enabled?: boolean | null
          management_rule_percent_of_rent?: number | null
          other_gbp_manual?: number | null
          property_id: string
          repairs_gbp_calculated?: number | null
          repairs_gbp_manual?: number | null
          repairs_rule_enabled?: boolean | null
          repairs_rule_percent_of_rent?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          bills_gbp_manual?: number | null
          compliance_gbp_manual?: number | null
          created_at?: string
          id?: string
          insurance_gbp_calculated?: number | null
          insurance_gbp_manual?: number | null
          insurance_rule_enabled?: boolean | null
          insurance_rule_percent_of_value?: number | null
          management_gbp_calculated?: number | null
          management_gbp_manual?: number | null
          management_rule_enabled?: boolean | null
          management_rule_percent_of_rent?: number | null
          other_gbp_manual?: number | null
          property_id?: string
          repairs_gbp_calculated?: number | null
          repairs_gbp_manual?: number | null
          repairs_rule_enabled?: boolean | null
          repairs_rule_percent_of_rent?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "costs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      dismissed_duplicates: {
        Row: {
          dismissed_at: string
          dismissed_by: string
          id: string
          org_id: string
          property_id_1: string
          property_id_2: string
          reason: string | null
        }
        Insert: {
          dismissed_at?: string
          dismissed_by: string
          id?: string
          org_id: string
          property_id_1: string
          property_id_2: string
          reason?: string | null
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string
          id?: string
          org_id?: string
          property_id_1?: string
          property_id_2?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_duplicates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_duplicates_property_id_1_fkey"
            columns: ["property_id_1"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_duplicates_property_id_2_fkey"
            columns: ["property_id_2"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      document_activity: {
        Row: {
          action: string
          details: Json | null
          document_id: string
          id: string
          ip_address: unknown
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          document_id: string
          id?: string
          ip_address?: unknown
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          document_id?: string
          id?: string
          ip_address?: unknown
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          entity_type: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          org_id: string | null
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          entity_type?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          org_id?: string | null
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          entity_type?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          org_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_share_links: {
        Row: {
          compliance_document_id: string | null
          created_at: string
          created_by: string
          document_id: string | null
          expires_at: string
          id: string
          is_active: boolean
          last_viewed_at: string | null
          max_views: number | null
          org_id: string
          password_hash: string | null
          token: string
          view_count: number
        }
        Insert: {
          compliance_document_id?: string | null
          created_at?: string
          created_by: string
          document_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          max_views?: number | null
          org_id: string
          password_hash?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          compliance_document_id?: string | null
          created_at?: string
          created_by?: string
          document_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          max_views?: number | null
          org_id?: string
          password_hash?: string | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_share_links_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_share_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_share_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_summaries: {
        Row: {
          ai_confidence: number | null
          ai_model: string | null
          comparable_evidence: Json | null
          condition_notes: string | null
          condition_rating: string | null
          created_at: string
          document_id: string
          executive_summary: string | null
          gross_internal_area_sqft: number | null
          id: string
          key_observations: string[] | null
          org_id: string
          price_per_sqft: number | null
          property_id: string | null
          property_type_noted: string | null
          raw_extraction: Json | null
          recommended_actions: string[] | null
          risk_factors: string[] | null
          special_assumptions: string[] | null
          status: string
          summary_type: string
          surveyor_firm: string | null
          surveyor_name: string | null
          surveyor_rics_number: string | null
          tenure: string | null
          updated_at: string
          valuation_basis: string | null
          valuation_date: string | null
          valuation_figure_gbp: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_model?: string | null
          comparable_evidence?: Json | null
          condition_notes?: string | null
          condition_rating?: string | null
          created_at?: string
          document_id: string
          executive_summary?: string | null
          gross_internal_area_sqft?: number | null
          id?: string
          key_observations?: string[] | null
          org_id: string
          price_per_sqft?: number | null
          property_id?: string | null
          property_type_noted?: string | null
          raw_extraction?: Json | null
          recommended_actions?: string[] | null
          risk_factors?: string[] | null
          special_assumptions?: string[] | null
          status?: string
          summary_type?: string
          surveyor_firm?: string | null
          surveyor_name?: string | null
          surveyor_rics_number?: string | null
          tenure?: string | null
          updated_at?: string
          valuation_basis?: string | null
          valuation_date?: string | null
          valuation_figure_gbp?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_model?: string | null
          comparable_evidence?: Json | null
          condition_notes?: string | null
          condition_rating?: string | null
          created_at?: string
          document_id?: string
          executive_summary?: string | null
          gross_internal_area_sqft?: number | null
          id?: string
          key_observations?: string[] | null
          org_id?: string
          price_per_sqft?: number | null
          property_id?: string | null
          property_type_noted?: string | null
          raw_extraction?: Json | null
          recommended_actions?: string[] | null
          risk_factors?: string[] | null
          special_assumptions?: string[] | null
          status?: string
          summary_type?: string
          surveyor_firm?: string | null
          surveyor_name?: string | null
          surveyor_rics_number?: string | null
          tenure?: string | null
          updated_at?: string
          valuation_basis?: string | null
          valuation_date?: string | null
          valuation_figure_gbp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_summaries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_summaries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_doc_type_confidence: number | null
          ai_model: string | null
          ai_property_confidence: number | null
          ai_suggested_doc_type: string | null
          ai_suggested_property_id: string | null
          ai_tokens_used: number | null
          auto_file_confidence: number | null
          auto_filed: boolean | null
          category: string | null
          company_id: string | null
          compliance_item_id: string | null
          contractor_job_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          display_name: string | null
          doc_type: string | null
          document_date: string | null
          expiry_date: string | null
          extracted_address_text: string | null
          extracted_certifier_company: string | null
          extracted_certifier_name: string | null
          extracted_data: Json | null
          extracted_epc_rating: string | null
          extracted_issue_date: string | null
          extracted_reference_number: string | null
          extraction_status: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          final_file_name: string | null
          id: string
          is_confidential: boolean | null
          is_current_version: boolean | null
          mime_type: string | null
          org_id: string
          original_file_name: string
          previous_version_id: string | null
          processing_time_ms: number | null
          property_id: string | null
          renamed_at: string | null
          review_status: string | null
          tags: Json | null
          tenancy_id: string | null
          tenant_id: string | null
          updated_at: string
          uploaded_by: string | null
          validation_errors: string[] | null
          validation_warnings: string[] | null
          version: number | null
          visible_to_shareholders: boolean | null
          visible_to_tenants: boolean | null
        }
        Insert: {
          ai_doc_type_confidence?: number | null
          ai_model?: string | null
          ai_property_confidence?: number | null
          ai_suggested_doc_type?: string | null
          ai_suggested_property_id?: string | null
          ai_tokens_used?: number | null
          auto_file_confidence?: number | null
          auto_filed?: boolean | null
          category?: string | null
          company_id?: string | null
          compliance_item_id?: string | null
          contractor_job_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_name?: string | null
          doc_type?: string | null
          document_date?: string | null
          expiry_date?: string | null
          extracted_address_text?: string | null
          extracted_certifier_company?: string | null
          extracted_certifier_name?: string | null
          extracted_data?: Json | null
          extracted_epc_rating?: string | null
          extracted_issue_date?: string | null
          extracted_reference_number?: string | null
          extraction_status?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          final_file_name?: string | null
          id?: string
          is_confidential?: boolean | null
          is_current_version?: boolean | null
          mime_type?: string | null
          org_id: string
          original_file_name: string
          previous_version_id?: string | null
          processing_time_ms?: number | null
          property_id?: string | null
          renamed_at?: string | null
          review_status?: string | null
          tags?: Json | null
          tenancy_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          validation_errors?: string[] | null
          validation_warnings?: string[] | null
          version?: number | null
          visible_to_shareholders?: boolean | null
          visible_to_tenants?: boolean | null
        }
        Update: {
          ai_doc_type_confidence?: number | null
          ai_model?: string | null
          ai_property_confidence?: number | null
          ai_suggested_doc_type?: string | null
          ai_suggested_property_id?: string | null
          ai_tokens_used?: number | null
          auto_file_confidence?: number | null
          auto_filed?: boolean | null
          category?: string | null
          company_id?: string | null
          compliance_item_id?: string | null
          contractor_job_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_name?: string | null
          doc_type?: string | null
          document_date?: string | null
          expiry_date?: string | null
          extracted_address_text?: string | null
          extracted_certifier_company?: string | null
          extracted_certifier_name?: string | null
          extracted_data?: Json | null
          extracted_epc_rating?: string | null
          extracted_issue_date?: string | null
          extracted_reference_number?: string | null
          extraction_status?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          final_file_name?: string | null
          id?: string
          is_confidential?: boolean | null
          is_current_version?: boolean | null
          mime_type?: string | null
          org_id?: string
          original_file_name?: string
          previous_version_id?: string | null
          processing_time_ms?: number | null
          property_id?: string | null
          renamed_at?: string | null
          review_status?: string | null
          tags?: Json | null
          tenancy_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          validation_errors?: string[] | null
          validation_warnings?: string[] | null
          version?: number | null
          visible_to_shareholders?: boolean | null
          visible_to_tenants?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_ai_suggested_property_id_fkey"
            columns: ["ai_suggested_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_compliance_item_id_fkey"
            columns: ["compliance_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contractor_job_id_fkey"
            columns: ["contractor_job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_beneficial_mapping: {
        Row: {
          beneficial_group_id: string
          created_at: string
          effective_from: string | null
          entity_id: string
          id: string
          notes: string | null
        }
        Insert: {
          beneficial_group_id: string
          created_at?: string
          effective_from?: string | null
          entity_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          beneficial_group_id?: string
          created_at?: string
          effective_from?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_beneficial_mapping_beneficial_group_id_fkey"
            columns: ["beneficial_group_id"]
            isOneToOne: false
            referencedRelation: "beneficial_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_beneficial_mapping_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "ownership_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_directors: {
        Row: {
          appointment_date: string
          created_at: string
          director_name: string
          entity_id: string
          id: string
          is_current: boolean | null
          resignation_date: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          created_at?: string
          director_name: string
          entity_id: string
          id?: string
          is_current?: boolean | null
          resignation_date?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          created_at?: string
          director_name?: string
          entity_id?: string
          id?: string
          is_current?: boolean | null
          resignation_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_directors_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "entity_directors_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_shareholders: {
        Row: {
          created_at: string
          effective_date: string
          effective_to: string | null
          entity_id: string
          id: string
          percentage: number
          share_class: string | null
          share_class_id: string | null
          shareholder_entity_id: string | null
          shareholder_name: string
          shareholder_type: string | null
          shares_held: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          effective_to?: string | null
          entity_id: string
          id?: string
          percentage: number
          share_class?: string | null
          share_class_id?: string | null
          shareholder_entity_id?: string | null
          shareholder_name: string
          shareholder_type?: string | null
          shares_held: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          effective_to?: string | null
          entity_id?: string
          id?: string
          percentage?: number
          share_class?: string | null
          share_class_id?: string | null
          shareholder_entity_id?: string | null
          shareholder_name?: string
          shareholder_type?: string | null
          shares_held?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_shareholders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "entity_shareholders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_shareholders_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_shareholders_shareholder_entity_id_fkey"
            columns: ["shareholder_entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "entity_shareholders_shareholder_entity_id_fkey"
            columns: ["shareholder_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_shareholdings: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          parent_entity_id: string
          shareholder_entity_id: string
          shareholder_percent: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          parent_entity_id: string
          shareholder_entity_id: string
          shareholder_percent: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          parent_entity_id?: string
          shareholder_entity_id?: string
          shareholder_percent?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_shareholdings_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "ownership_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_shareholdings_shareholder_entity_id_fkey"
            columns: ["shareholder_entity_id"]
            isOneToOne: false
            referencedRelation: "ownership_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          document_type: string | null
          escalation_level: number | null
          id: string
          is_active: boolean | null
          org_id: string | null
          rule_name: string
          trigger_condition: string
          trigger_value: number
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          document_type?: string | null
          escalation_level?: number | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          rule_name: string
          trigger_condition: string
          trigger_value: number
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          document_type?: string | null
          escalation_level?: number | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          rule_name?: string
          trigger_condition?: string
          trigger_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          category_name: string
          category_type: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          maps_to_snapshot_field: string
        }
        Insert: {
          category_name: string
          category_type: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          maps_to_snapshot_field: string
        }
        Update: {
          category_name?: string
          category_type?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          maps_to_snapshot_field?: string
        }
        Relationships: []
      }
      financial_snapshots: {
        Row: {
          council_tax: number | null
          created_at: string | null
          debt_at_snapshot: number | null
          entity_id: string
          equity_at_snapshot: number | null
          gross_rent_due: number | null
          gross_rent_received: number | null
          id: string
          insurance_costs: number | null
          is_locked: boolean | null
          licensing_costs: number | null
          locked_at: string | null
          locked_by: string | null
          ltv_at_snapshot: number | null
          maintenance_costs: number | null
          management_fees: number | null
          mortgage_payments: number | null
          net_cash_flow: number | null
          net_operating_income: number | null
          notes: string | null
          occupancy_rate: number | null
          org_id: string
          other_costs: number | null
          other_income: number | null
          professional_fees: number | null
          property_id: string
          rent_collection_rate: number | null
          snapshot_month: string
          total_costs: number | null
          updated_at: string | null
          utilities: number | null
          valuation_at_snapshot: number | null
          void_loss: number | null
        }
        Insert: {
          council_tax?: number | null
          created_at?: string | null
          debt_at_snapshot?: number | null
          entity_id: string
          equity_at_snapshot?: number | null
          gross_rent_due?: number | null
          gross_rent_received?: number | null
          id?: string
          insurance_costs?: number | null
          is_locked?: boolean | null
          licensing_costs?: number | null
          locked_at?: string | null
          locked_by?: string | null
          ltv_at_snapshot?: number | null
          maintenance_costs?: number | null
          management_fees?: number | null
          mortgage_payments?: number | null
          net_cash_flow?: number | null
          net_operating_income?: number | null
          notes?: string | null
          occupancy_rate?: number | null
          org_id: string
          other_costs?: number | null
          other_income?: number | null
          professional_fees?: number | null
          property_id: string
          rent_collection_rate?: number | null
          snapshot_month: string
          total_costs?: number | null
          updated_at?: string | null
          utilities?: number | null
          valuation_at_snapshot?: number | null
          void_loss?: number | null
        }
        Update: {
          council_tax?: number | null
          created_at?: string | null
          debt_at_snapshot?: number | null
          entity_id?: string
          equity_at_snapshot?: number | null
          gross_rent_due?: number | null
          gross_rent_received?: number | null
          id?: string
          insurance_costs?: number | null
          is_locked?: boolean | null
          licensing_costs?: number | null
          locked_at?: string | null
          locked_by?: string | null
          ltv_at_snapshot?: number | null
          maintenance_costs?: number | null
          management_fees?: number | null
          mortgage_payments?: number | null
          net_cash_flow?: number | null
          net_operating_income?: number | null
          notes?: string | null
          occupancy_rate?: number | null
          org_id?: string
          other_costs?: number | null
          other_income?: number | null
          professional_fees?: number | null
          property_id?: string
          rent_collection_rate?: number | null
          snapshot_month?: string
          total_costs?: number | null
          updated_at?: string | null
          utilities?: number | null
          valuation_at_snapshot?: number | null
          void_loss?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "financial_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      floorplans: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          final_file_name: string | null
          id: string
          is_primary: boolean
          notes: string | null
          original_file_name: string
          property_id: string
          updated_at: string
          uploaded_at: string
          version_label: string | null
        }
        Insert: {
          created_at?: string
          file_type: string
          file_url: string
          final_file_name?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          original_file_name: string
          property_id: string
          updated_at?: string
          uploaded_at?: string
          version_label?: string | null
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          final_file_name?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          original_file_name?: string
          property_id?: string
          updated_at?: string
          uploaded_at?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floorplans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      freeagent_connections: {
        Row: {
          access_token_encrypted: string
          auto_sync_enabled: boolean | null
          bank_account_url: string | null
          company_id: string
          connected_at: string
          connected_by: string | null
          entity_id: string | null
          expense_category_url: string | null
          freeagent_company_name: string | null
          freeagent_company_url: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_items_count: number | null
          last_sync_status: string | null
          org_id: string
          refresh_token_encrypted: string
          rent_income_category_url: string | null
          sync_expenses: boolean | null
          sync_rent_payments: boolean | null
          token_expires_at: string
          updated_at: string
          use_sandbox: boolean | null
        }
        Insert: {
          access_token_encrypted: string
          auto_sync_enabled?: boolean | null
          bank_account_url?: string | null
          company_id: string
          connected_at?: string
          connected_by?: string | null
          entity_id?: string | null
          expense_category_url?: string | null
          freeagent_company_name?: string | null
          freeagent_company_url?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items_count?: number | null
          last_sync_status?: string | null
          org_id: string
          refresh_token_encrypted: string
          rent_income_category_url?: string | null
          sync_expenses?: boolean | null
          sync_rent_payments?: boolean | null
          token_expires_at: string
          updated_at?: string
          use_sandbox?: boolean | null
        }
        Update: {
          access_token_encrypted?: string
          auto_sync_enabled?: boolean | null
          bank_account_url?: string | null
          company_id?: string
          connected_at?: string
          connected_by?: string | null
          entity_id?: string | null
          expense_category_url?: string | null
          freeagent_company_name?: string | null
          freeagent_company_url?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_items_count?: number | null
          last_sync_status?: string | null
          org_id?: string
          refresh_token_encrypted?: string
          rent_income_category_url?: string | null
          sync_expenses?: boolean | null
          sync_rent_payments?: boolean | null
          token_expires_at?: string
          updated_at?: string
          use_sandbox?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "freeagent_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freeagent_connections_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "freeagent_connections_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freeagent_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      freeagent_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          freeagent_connection_id: string
          freeagent_contact_url: string | null
          freeagent_invoice_url: string | null
          id: string
          org_id: string
          source_id: string
          source_table: string
          status: string
          synced_at: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          freeagent_connection_id: string
          freeagent_contact_url?: string | null
          freeagent_invoice_url?: string | null
          id?: string
          org_id: string
          source_id: string
          source_table: string
          status?: string
          synced_at?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          freeagent_connection_id?: string
          freeagent_contact_url?: string | null
          freeagent_invoice_url?: string | null
          id?: string
          org_id?: string
          source_id?: string
          source_table?: string
          status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freeagent_sync_log_freeagent_connection_id_fkey"
            columns: ["freeagent_connection_id"]
            isOneToOne: false
            referencedRelation: "freeagent_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freeagent_sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      go_live_checklists: {
        Row: {
          build_fire_alarm_installed: boolean
          build_heating_operational: boolean
          build_major_works_complete: boolean
          build_practical_completion: boolean
          build_utilities_live: boolean
          compliance_eicr_uploaded: boolean
          compliance_emergency_lighting_not_applicable: boolean
          compliance_emergency_lighting_uploaded: boolean
          compliance_epc_uploaded: boolean
          compliance_fire_alarm_cert_uploaded: boolean
          compliance_gas_safety_not_applicable: boolean
          compliance_gas_safety_uploaded: boolean
          compliance_hmo_licence_not_applicable: boolean
          compliance_hmo_licence_uploaded: boolean
          compliance_legionella_uploaded: boolean
          created_at: string
          final_confirmation: boolean
          finance_expected_income_populated: boolean
          finance_mortgage_added: boolean
          finance_mortgage_rate_entered: boolean
          finance_rent_values_entered: boolean
          finance_rental_strategy_selected: boolean
          finance_unencumbered: boolean
          go_live_approved_at: string | null
          go_live_approved_by: string | null
          id: string
          property_id: string
          setup_address_verified: boolean
          setup_legal_owner_confirmed: boolean
          setup_local_authority_confirmed: boolean
          setup_ownership_confirmed: boolean
          setup_tenure_confirmed: boolean
          updated_at: string
        }
        Insert: {
          build_fire_alarm_installed?: boolean
          build_heating_operational?: boolean
          build_major_works_complete?: boolean
          build_practical_completion?: boolean
          build_utilities_live?: boolean
          compliance_eicr_uploaded?: boolean
          compliance_emergency_lighting_not_applicable?: boolean
          compliance_emergency_lighting_uploaded?: boolean
          compliance_epc_uploaded?: boolean
          compliance_fire_alarm_cert_uploaded?: boolean
          compliance_gas_safety_not_applicable?: boolean
          compliance_gas_safety_uploaded?: boolean
          compliance_hmo_licence_not_applicable?: boolean
          compliance_hmo_licence_uploaded?: boolean
          compliance_legionella_uploaded?: boolean
          created_at?: string
          final_confirmation?: boolean
          finance_expected_income_populated?: boolean
          finance_mortgage_added?: boolean
          finance_mortgage_rate_entered?: boolean
          finance_rent_values_entered?: boolean
          finance_rental_strategy_selected?: boolean
          finance_unencumbered?: boolean
          go_live_approved_at?: string | null
          go_live_approved_by?: string | null
          id?: string
          property_id: string
          setup_address_verified?: boolean
          setup_legal_owner_confirmed?: boolean
          setup_local_authority_confirmed?: boolean
          setup_ownership_confirmed?: boolean
          setup_tenure_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          build_fire_alarm_installed?: boolean
          build_heating_operational?: boolean
          build_major_works_complete?: boolean
          build_practical_completion?: boolean
          build_utilities_live?: boolean
          compliance_eicr_uploaded?: boolean
          compliance_emergency_lighting_not_applicable?: boolean
          compliance_emergency_lighting_uploaded?: boolean
          compliance_epc_uploaded?: boolean
          compliance_fire_alarm_cert_uploaded?: boolean
          compliance_gas_safety_not_applicable?: boolean
          compliance_gas_safety_uploaded?: boolean
          compliance_hmo_licence_not_applicable?: boolean
          compliance_hmo_licence_uploaded?: boolean
          compliance_legionella_uploaded?: boolean
          created_at?: string
          final_confirmation?: boolean
          finance_expected_income_populated?: boolean
          finance_mortgage_added?: boolean
          finance_mortgage_rate_entered?: boolean
          finance_rent_values_entered?: boolean
          finance_rental_strategy_selected?: boolean
          finance_unencumbered?: boolean
          go_live_approved_at?: string | null
          go_live_approved_by?: string | null
          id?: string
          property_id?: string
          setup_address_verified?: boolean
          setup_legal_owner_confirmed?: boolean
          setup_local_authority_confirmed?: boolean
          setup_ownership_confirmed?: boolean
          setup_tenure_confirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "go_live_checklists_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          party_id: string
          role: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          party_id: string
          role?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          party_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ownership_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          bank_account_id: string
          date_range_end: string | null
          date_range_start: string | null
          duplicate_count: number | null
          error_message: string | null
          file_name: string
          id: string
          imported_at: string | null
          imported_by: string | null
          imported_count: number
          org_id: string
          row_count: number
          status: string | null
        }
        Insert: {
          bank_account_id: string
          date_range_end?: string | null
          date_range_start?: string | null
          duplicate_count?: number | null
          error_message?: string | null
          file_name: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          imported_count?: number
          org_id: string
          row_count?: number
          status?: string | null
        }
        Update: {
          bank_account_id?: string
          date_range_end?: string | null
          date_range_start?: string | null
          duplicate_count?: number | null
          error_message?: string | null
          file_name?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          imported_count?: number
          org_id?: string
          row_count?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_emails: {
        Row: {
          ai_extraction: Json | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          compliance_updated: boolean | null
          created_at: string
          document_created_id: string | null
          from_email: string
          from_name: string | null
          id: string
          job_updated: boolean | null
          match_confidence: string | null
          matched_compliance_item_id: string | null
          matched_job_id: string | null
          matched_property_id: string | null
          message_id: string | null
          org_id: string
          processed_at: string | null
          processing_error: string | null
          processing_status: string | null
          received_at: string
          requires_review: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          subject: string | null
          to_email: string
        }
        Insert: {
          ai_extraction?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          compliance_updated?: boolean | null
          created_at?: string
          document_created_id?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          job_updated?: boolean | null
          match_confidence?: string | null
          matched_compliance_item_id?: string | null
          matched_job_id?: string | null
          matched_property_id?: string | null
          message_id?: string | null
          org_id: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          received_at?: string
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject?: string | null
          to_email: string
        }
        Update: {
          ai_extraction?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          compliance_updated?: boolean | null
          created_at?: string
          document_created_id?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          job_updated?: boolean | null
          match_confidence?: string | null
          matched_compliance_item_id?: string | null
          matched_job_id?: string | null
          matched_property_id?: string | null
          message_id?: string | null
          org_id?: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          received_at?: string
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_document_created_id_fkey"
            columns: ["document_created_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_matched_compliance_item_id_fkey"
            columns: ["matched_compliance_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_matched_job_id_fkey"
            columns: ["matched_job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_matched_property_id_fkey"
            columns: ["matched_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          annual_rent_gbp: number
          created_at: string
          id: string
          property_id: string
          updated_at: string
          year: number
        }
        Insert: {
          annual_rent_gbp?: number
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
          year: number
        }
        Update: {
          annual_rent_gbp?: number
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "income_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          auto_renew: boolean | null
          buildings_cover_gbp: number | null
          contents_cover_gbp: number | null
          cover_type: string | null
          created_at: string
          excess_gbp: number | null
          id: string
          insurer_name: string | null
          notes: string | null
          org_id: string | null
          payment_frequency: string | null
          policy_number: string | null
          policy_type: string | null
          premium_gbp: number | null
          property_id: string
          renewal_date: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean | null
          buildings_cover_gbp?: number | null
          contents_cover_gbp?: number | null
          cover_type?: string | null
          created_at?: string
          excess_gbp?: number | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          org_id?: string | null
          payment_frequency?: string | null
          policy_number?: string | null
          policy_type?: string | null
          premium_gbp?: number | null
          property_id: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean | null
          buildings_cover_gbp?: number | null
          contents_cover_gbp?: number | null
          cover_type?: string | null
          created_at?: string
          excess_gbp?: number | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          org_id?: string | null
          payment_frequency?: string | null
          policy_number?: string | null
          policy_type?: string | null
          premium_gbp?: number | null
          property_id?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_commitments: {
        Row: {
          commitment_date: string
          commitment_type: string
          committed_amount: number
          coupon_rate: number | null
          created_at: string
          documentation_url: string | null
          drawn_amount: number | null
          entity_id: string
          equity_percentage: number | null
          id: string
          investor_id: string
          maturity_date: string | null
          notes: string | null
          org_id: string
          payment_frequency: string | null
          status: string
          updated_at: string
        }
        Insert: {
          commitment_date: string
          commitment_type: string
          committed_amount: number
          coupon_rate?: number | null
          created_at?: string
          documentation_url?: string | null
          drawn_amount?: number | null
          entity_id: string
          equity_percentage?: number | null
          id?: string
          investor_id: string
          maturity_date?: string | null
          notes?: string | null
          org_id: string
          payment_frequency?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          commitment_date?: string
          commitment_type?: string
          committed_amount?: number
          coupon_rate?: number | null
          created_at?: string
          documentation_url?: string | null
          drawn_amount?: number | null
          entity_id?: string
          equity_percentage?: number | null
          id?: string
          investor_id?: string
          maturity_date?: string | null
          notes?: string | null
          org_id?: string
          payment_frequency?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_summary"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_distributions: {
        Row: {
          amount: number
          commitment_id: string
          created_at: string
          distribution_date: string
          distribution_type: string
          entity_id: string
          id: string
          investor_id: string
          net_amount: number | null
          notes: string | null
          org_id: string
          payment_method: string | null
          payment_reference: string | null
          period_from: string | null
          period_to: string | null
          status: string
          tax_deducted: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          commitment_id: string
          created_at?: string
          distribution_date: string
          distribution_type: string
          entity_id: string
          id?: string
          investor_id: string
          net_amount?: number | null
          notes?: string | null
          org_id: string
          payment_method?: string | null
          payment_reference?: string | null
          period_from?: string | null
          period_to?: string | null
          status?: string
          tax_deducted?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          commitment_id?: string
          created_at?: string
          distribution_date?: string
          distribution_type?: string
          entity_id?: string
          id?: string
          investor_id?: string
          net_amount?: number | null
          notes?: string | null
          org_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          period_from?: string | null
          period_to?: string | null
          status?: string
          tax_deducted?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_distributions_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "investor_commitment_detail"
            referencedColumns: ["commitment_id"]
          },
          {
            foreignKeyName: "investor_distributions_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "investor_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_distributions_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "investor_return_metrics"
            referencedColumns: ["commitment_id"]
          },
          {
            foreignKeyName: "investor_distributions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "investor_distributions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_distributions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_summary"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_distributions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_distributions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_reports: {
        Row: {
          created_at: string
          entity_id: string | null
          file_name: string | null
          file_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          investor_id: string | null
          notes: string | null
          org_id: string
          report_period_from: string
          report_period_to: string
          report_type: string
          sent_at: string | null
          sent_to_investor: boolean | null
          title: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          file_name?: string | null
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          investor_id?: string | null
          notes?: string | null
          org_id: string
          report_period_from: string
          report_period_to: string
          report_type: string
          sent_at?: string | null
          sent_to_investor?: boolean | null
          title: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          file_name?: string | null
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          investor_id?: string | null
          notes?: string | null
          org_id?: string
          report_period_from?: string
          report_period_to?: string
          report_type?: string
          sent_at?: string | null
          sent_to_investor?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_reports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "investor_reports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_reports_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_summary"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_reports_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          accredited_investor: boolean | null
          address: string | null
          communication_preference: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          investor_name: string
          investor_type: string
          kyc_completed: boolean | null
          kyc_completed_date: string | null
          notes: string | null
          org_id: string
          phone: string | null
          portal_access_enabled: boolean | null
          portal_user_id: string | null
          preferred_currency: string | null
          risk_profile: string | null
          tax_residency: string | null
          updated_at: string
        }
        Insert: {
          accredited_investor?: boolean | null
          address?: string | null
          communication_preference?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          investor_name: string
          investor_type: string
          kyc_completed?: boolean | null
          kyc_completed_date?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          portal_access_enabled?: boolean | null
          portal_user_id?: string | null
          preferred_currency?: string | null
          risk_profile?: string | null
          tax_residency?: string | null
          updated_at?: string
        }
        Update: {
          accredited_investor?: boolean | null
          address?: string | null
          communication_preference?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          investor_name?: string
          investor_type?: string
          kyc_completed?: boolean | null
          kyc_completed_date?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          portal_access_enabled?: boolean | null
          portal_user_id?: string | null
          preferred_currency?: string | null
          risk_profile?: string | null
          tax_residency?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_follow_ups: {
        Row: {
          created_at: string
          created_by: string | null
          follow_up_type: string | null
          id: string
          job_id: string
          message: string | null
          response_received: boolean | null
          response_text: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          follow_up_type?: string | null
          id?: string
          job_id: string
          message?: string | null
          response_received?: boolean | null
          response_text?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          follow_up_type?: string | null
          id?: string
          job_id?: string
          message?: string | null
          response_received?: boolean | null
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_follow_ups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_request_templates: {
        Row: {
          body_template: string
          compliance_type: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          org_id: string
          subject_template: string
        }
        Insert: {
          body_template: string
          compliance_type?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          org_id: string
          subject_template: string
        }
        Update: {
          body_template?: string
          compliance_type?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          org_id?: string
          subject_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_request_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leasehold_details: {
        Row: {
          created_at: string
          ground_rent_annual: number | null
          ground_rent_escalation: string | null
          ground_rent_review_date: string | null
          id: string
          lease_start_date: string | null
          managing_agent: string | null
          managing_agent_email: string | null
          managing_agent_phone: string | null
          next_review_date: string | null
          notes: string | null
          org_id: string
          original_term_years: number | null
          property_id: string
          section_20_notices_pending: boolean | null
          service_charge_annual: number | null
          service_charge_review_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ground_rent_annual?: number | null
          ground_rent_escalation?: string | null
          ground_rent_review_date?: string | null
          id?: string
          lease_start_date?: string | null
          managing_agent?: string | null
          managing_agent_email?: string | null
          managing_agent_phone?: string | null
          next_review_date?: string | null
          notes?: string | null
          org_id: string
          original_term_years?: number | null
          property_id: string
          section_20_notices_pending?: boolean | null
          service_charge_annual?: number | null
          service_charge_review_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ground_rent_annual?: number | null
          ground_rent_escalation?: string | null
          ground_rent_review_date?: string | null
          id?: string
          lease_start_date?: string | null
          managing_agent?: string | null
          managing_agent_email?: string | null
          managing_agent_phone?: string | null
          next_review_date?: string | null
          notes?: string | null
          org_id?: string
          original_term_years?: number | null
          property_id?: string
          section_20_notices_pending?: boolean | null
          service_charge_annual?: number | null
          service_charge_review_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leasehold_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leasehold_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          accounts_due_date: string | null
          accounts_last_filed_date: string | null
          accounts_period_end: string | null
          ch_company_status: string | null
          ch_company_type: string | null
          ch_last_synced_at: string | null
          company_number: string | null
          confirmation_statement_due_date: string | null
          confirmation_statement_last_filed_date: string | null
          confirmation_statement_last_made_up_to: string | null
          corporation_tax_ref: string | null
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          incorporation_date: string | null
          is_group_parent: boolean | null
          issued_shares: number | null
          notes: string | null
          org_id: string
          registered_address: string | null
          status: string
          updated_at: string
          vat_number: string | null
          vat_registered: boolean | null
        }
        Insert: {
          accounts_due_date?: string | null
          accounts_last_filed_date?: string | null
          accounts_period_end?: string | null
          ch_company_status?: string | null
          ch_company_type?: string | null
          ch_last_synced_at?: string | null
          company_number?: string | null
          confirmation_statement_due_date?: string | null
          confirmation_statement_last_filed_date?: string | null
          confirmation_statement_last_made_up_to?: string | null
          corporation_tax_ref?: string | null
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          incorporation_date?: string | null
          is_group_parent?: boolean | null
          issued_shares?: number | null
          notes?: string | null
          org_id: string
          registered_address?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Update: {
          accounts_due_date?: string | null
          accounts_last_filed_date?: string | null
          accounts_period_end?: string | null
          ch_company_status?: string | null
          ch_company_type?: string | null
          ch_last_synced_at?: string | null
          company_number?: string | null
          confirmation_statement_due_date?: string | null
          confirmation_statement_last_filed_date?: string | null
          confirmation_statement_last_made_up_to?: string | null
          corporation_tax_ref?: string | null
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          incorporation_date?: string | null
          is_group_parent?: boolean | null
          issued_shares?: number | null
          notes?: string | null
          org_id?: string
          registered_address?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          broker_email: string | null
          broker_name: string | null
          broker_phone: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          lender_name: string
          lender_type: string
          notes: string | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          lender_name: string
          lender_type: string
          notes?: string | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          lender_name?: string
          lender_type?: string
          notes?: string | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lenders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_facilities: {
        Row: {
          account_reference: string | null
          arrangement_fee: number | null
          covenant_icr_min: number | null
          covenant_ltv_max: number | null
          created_at: string | null
          current_balance: number
          current_ltv: number | null
          early_repayment_charge_until: string | null
          entity_id: string
          erc_percentage: number | null
          facility_type: string
          id: string
          interest_only: boolean | null
          interest_rate: number
          legal_fee: number | null
          lender_id: string
          ltv_at_drawdown: number | null
          monthly_payment: number | null
          notes: string | null
          org_id: string
          original_amount: number
          product_name: string | null
          property_id: string
          rate_expiry_date: string | null
          rate_type: string
          repayment_type: string
          revert_rate: number | null
          status: string
          term_end_date: string
          term_start_date: string
          total_setup_costs: number | null
          updated_at: string | null
          valuation_fee: number | null
        }
        Insert: {
          account_reference?: string | null
          arrangement_fee?: number | null
          covenant_icr_min?: number | null
          covenant_ltv_max?: number | null
          created_at?: string | null
          current_balance: number
          current_ltv?: number | null
          early_repayment_charge_until?: string | null
          entity_id: string
          erc_percentage?: number | null
          facility_type: string
          id?: string
          interest_only?: boolean | null
          interest_rate: number
          legal_fee?: number | null
          lender_id: string
          ltv_at_drawdown?: number | null
          monthly_payment?: number | null
          notes?: string | null
          org_id: string
          original_amount: number
          product_name?: string | null
          property_id: string
          rate_expiry_date?: string | null
          rate_type: string
          repayment_type?: string
          revert_rate?: number | null
          status?: string
          term_end_date: string
          term_start_date: string
          total_setup_costs?: number | null
          updated_at?: string | null
          valuation_fee?: number | null
        }
        Update: {
          account_reference?: string | null
          arrangement_fee?: number | null
          covenant_icr_min?: number | null
          covenant_ltv_max?: number | null
          created_at?: string | null
          current_balance?: number
          current_ltv?: number | null
          early_repayment_charge_until?: string | null
          entity_id?: string
          erc_percentage?: number | null
          facility_type?: string
          id?: string
          interest_only?: boolean | null
          interest_rate?: number
          legal_fee?: number | null
          lender_id?: string
          ltv_at_drawdown?: number | null
          monthly_payment?: number | null
          notes?: string | null
          org_id?: string
          original_amount?: number
          product_name?: string | null
          property_id?: string
          rate_expiry_date?: string | null
          rate_type?: string
          repayment_type?: string
          revert_rate?: number | null
          status?: string
          term_end_date?: string
          term_start_date?: string
          total_setup_costs?: number | null
          updated_at?: string | null
          valuation_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_facilities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "loan_facilities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "portfolio_debt_summary"
            referencedColumns: ["lender_id"]
          },
          {
            foreignKeyName: "loan_facilities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      loans: {
        Row: {
          broker_contact: string | null
          broker_name: string | null
          capital_or_interest: string | null
          created_at: string
          current_mortgage_balance_gbp: number | null
          fixed_or_variable: string | null
          fixed_rate_expires: string | null
          id: string
          interest_rate_percent: number | null
          lender: string | null
          loan_start_date: string | null
          loan_term_months: number | null
          mortgage_payment_gbp: number | null
          mortgage_type: string | null
          notes: string | null
          payment_auto_calculated_gbp: number | null
          payment_override_gbp: number | null
          payment_source: string | null
          property_id: string
          refinance_target_date: string | null
          reversion_rate_percent: number | null
          term_years: number | null
          updated_at: string
        }
        Insert: {
          broker_contact?: string | null
          broker_name?: string | null
          capital_or_interest?: string | null
          created_at?: string
          current_mortgage_balance_gbp?: number | null
          fixed_or_variable?: string | null
          fixed_rate_expires?: string | null
          id?: string
          interest_rate_percent?: number | null
          lender?: string | null
          loan_start_date?: string | null
          loan_term_months?: number | null
          mortgage_payment_gbp?: number | null
          mortgage_type?: string | null
          notes?: string | null
          payment_auto_calculated_gbp?: number | null
          payment_override_gbp?: number | null
          payment_source?: string | null
          property_id: string
          refinance_target_date?: string | null
          reversion_rate_percent?: number | null
          term_years?: number | null
          updated_at?: string
        }
        Update: {
          broker_contact?: string | null
          broker_name?: string | null
          capital_or_interest?: string | null
          created_at?: string
          current_mortgage_balance_gbp?: number | null
          fixed_or_variable?: string | null
          fixed_rate_expires?: string | null
          id?: string
          interest_rate_percent?: number | null
          lender?: string | null
          loan_start_date?: string | null
          loan_term_months?: number | null
          mortgage_payment_gbp?: number | null
          mortgage_type?: string | null
          notes?: string | null
          payment_auto_calculated_gbp?: number | null
          payment_override_gbp?: number | null
          payment_source?: string | null
          property_id?: string
          refinance_target_date?: string | null
          reversion_rate_percent?: number | null
          term_years?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      local_authorities: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_authorities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_comments: {
        Row: {
          author_name: string
          author_type: string
          comment: string
          created_at: string
          id: string
          is_internal: boolean | null
          maintenance_request_id: string
          org_id: string
          photo_urls: string[] | null
        }
        Insert: {
          author_name: string
          author_type?: string
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          maintenance_request_id: string
          org_id: string
          photo_urls?: string[] | null
        }
        Update: {
          author_name?: string
          author_type?: string
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          maintenance_request_id?: string
          org_id?: string
          photo_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_comments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_overview"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "maintenance_comments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_quotes: {
        Row: {
          amount: number
          contractor_id: string | null
          contractor_name: string | null
          created_at: string | null
          description: string | null
          estimated_days: number | null
          id: string
          maintenance_request_id: string
          notes: string | null
          org_id: string
          quote_document_path: string | null
          status: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          amount: number
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          maintenance_request_id: string
          notes?: string | null
          org_id: string
          quote_document_path?: string | null
          status?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          amount?: number
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          maintenance_request_id?: string
          notes?: string | null
          org_id?: string
          quote_document_path?: string | null
          status?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_quotes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "compliance_contractors_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_quotes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_maintenance_performance"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "maintenance_quotes_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_overview"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "maintenance_quotes_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          actual_cost: number | null
          category: string
          cost_approved_at: string | null
          cost_approved_by: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          invoice_reference: string | null
          is_emergency: boolean | null
          is_recurring: boolean | null
          linked_request_id: string | null
          location_detail: string | null
          notes: string | null
          org_id: string
          photo_urls: string[] | null
          priority: string
          property_id: string | null
          property_v2_id: string | null
          reported_by: string
          reported_date: string
          room_id: string | null
          room_v2_id: string | null
          status: string
          tenant_id: string | null
          tenant_v2_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          category?: string
          cost_approved_at?: string | null
          cost_approved_by?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          invoice_reference?: string | null
          is_emergency?: boolean | null
          is_recurring?: boolean | null
          linked_request_id?: string | null
          location_detail?: string | null
          notes?: string | null
          org_id: string
          photo_urls?: string[] | null
          priority?: string
          property_id?: string | null
          property_v2_id?: string | null
          reported_by?: string
          reported_date?: string
          room_id?: string | null
          room_v2_id?: string | null
          status?: string
          tenant_id?: string | null
          tenant_v2_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          category?: string
          cost_approved_at?: string | null
          cost_approved_by?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          invoice_reference?: string | null
          is_emergency?: boolean | null
          is_recurring?: boolean | null
          linked_request_id?: string | null
          location_detail?: string | null
          notes?: string | null
          org_id?: string
          photo_urls?: string[] | null
          priority?: string
          property_id?: string | null
          property_v2_id?: string | null
          reported_by?: string
          reported_date?: string
          room_id?: string | null
          room_v2_id?: string | null
          status?: string
          tenant_id?: string | null
          tenant_v2_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_linked_request_id_fkey"
            columns: ["linked_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_overview"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "maintenance_requests_linked_request_id_fkey"
            columns: ["linked_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_v2_id_fkey"
            columns: ["property_v2_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_v2_id_fkey"
            columns: ["property_v2_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "maintenance_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_room_v2_id_fkey"
            columns: ["room_v2_id"]
            isOneToOne: false
            referencedRelation: "rooms_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_v2_id_fkey"
            columns: ["tenant_v2_id"]
            isOneToOne: false
            referencedRelation: "tenants_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_updates: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_type: Database["public"]["Enums"]["update_creator_type"]
          id: string
          message: string
          photos: string[] | null
          request_id: string
          update_type: string
          visible_to_tenant: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_type?: Database["public"]["Enums"]["update_creator_type"]
          id?: string
          message: string
          photos?: string[] | null
          request_id: string
          update_type: string
          visible_to_tenant?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_type?: Database["public"]["Enums"]["update_creator_type"]
          id?: string
          message?: string
          photos?: string[] | null
          request_id?: string
          update_type?: string
          visible_to_tenant?: boolean
        }
        Relationships: []
      }
      management_companies: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          org_id: string
          recipient: string
          reference_id: string | null
          reference_type: string | null
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          org_id: string
          recipient: string
          reference_id?: string | null
          reference_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          org_id?: string
          recipient?: string
          reference_id?: string | null
          reference_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_address: string | null
          email_enabled: boolean
          id: string
          notify_expired: boolean
          notify_expiring_soon: boolean
          notify_negative_cashflow: boolean
          notify_rate_expiry: boolean
          org_id: string
          reminder_days: number[]
          timezone: string
          updated_at: string
          user_id: string
          weekly_digest_day: number
          weekly_digest_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          id?: string
          notify_expired?: boolean
          notify_expiring_soon?: boolean
          notify_negative_cashflow?: boolean
          notify_rate_expiry?: boolean
          org_id: string
          reminder_days?: number[]
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_digest_day?: number
          weekly_digest_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          id?: string
          notify_expired?: boolean
          notify_expiring_soon?: boolean
          notify_negative_cashflow?: boolean
          notify_rate_expiry?: boolean
          org_id?: string
          reminder_days?: number[]
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_digest_day?: number
          weekly_digest_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          link_to: string | null
          message: string
          org_id: string
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_to?: string | null
          message: string
          org_id: string
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_to?: string | null
          message?: string
          org_id?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ownership_entities: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          name: string
          notes: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_links: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          owner_party_id: string
          ownership_type: string
          percent: number
          shares: number | null
          source: string
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          owner_party_id: string
          ownership_type?: string
          percent: number
          shares?: number | null
          source?: string
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          owner_party_id?: string
          ownership_type?: string
          percent?: number
          shares?: number | null
          source?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_links_owner_party_id_fkey"
            columns: ["owner_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          company_number: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_principal: boolean
          legal_name: string | null
          org_id: string
          party_type: string
          updated_at: string
        }
        Insert: {
          company_number?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_principal?: boolean
          legal_name?: string | null
          org_id: string
          party_type: string
          updated_at?: string
        }
        Update: {
          company_number?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_principal?: boolean
          legal_name?: string | null
          org_id?: string
          party_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_autofill_suggestions: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          confidence: number
          created_at: string
          evidence_excerpt: string | null
          field_key: string
          id: string
          property_id: string
          rejected_at: string | null
          rejected_by: string | null
          source_ref: string | null
          source_type: Database["public"]["Enums"]["autofill_source_type"]
          status: Database["public"]["Enums"]["autofill_suggestion_status"]
          suggested_value: Json
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          confidence: number
          created_at?: string
          evidence_excerpt?: string | null
          field_key: string
          id?: string
          property_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          source_ref?: string | null
          source_type: Database["public"]["Enums"]["autofill_source_type"]
          status?: Database["public"]["Enums"]["autofill_suggestion_status"]
          suggested_value: Json
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          confidence?: number
          created_at?: string
          evidence_excerpt?: string | null
          field_key?: string
          id?: string
          property_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          source_ref?: string | null
          source_type?: Database["public"]["Enums"]["autofill_source_type"]
          status?: Database["public"]["Enums"]["autofill_suggestion_status"]
          suggested_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "passport_autofill_suggestions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_field_audit: {
        Row: {
          change_reason: Database["public"]["Enums"]["passport_change_reason"]
          changed_at: string
          changed_by: string | null
          confidence: number | null
          field_key: string
          id: string
          new_value: Json | null
          old_value: Json | null
          property_id: string
          source_ref: string | null
          source_type:
            | Database["public"]["Enums"]["autofill_source_type"]
            | null
        }
        Insert: {
          change_reason: Database["public"]["Enums"]["passport_change_reason"]
          changed_at?: string
          changed_by?: string | null
          confidence?: number | null
          field_key: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          property_id: string
          source_ref?: string | null
          source_type?:
            | Database["public"]["Enums"]["autofill_source_type"]
            | null
        }
        Update: {
          change_reason?: Database["public"]["Enums"]["passport_change_reason"]
          changed_at?: string
          changed_by?: string | null
          confidence?: number | null
          field_key?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          property_id?: string
          source_ref?: string | null
          source_type?:
            | Database["public"]["Enums"]["autofill_source_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_field_audit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          org_id: string
          recipient_email: string | null
          recipient_name: string | null
          reminder_type: string
          rent_schedule_id: string
          resend_id: string | null
          sent_at: string
          sent_via: string
          status: string
          tenancy_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          org_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          reminder_type: string
          rent_schedule_id: string
          resend_id?: string | null
          sent_at?: string
          sent_via?: string
          status?: string
          tenancy_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          org_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          reminder_type?: string
          rent_schedule_id?: string
          resend_id?: string | null
          sent_at?: string
          sent_via?: string
          status?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_rent_schedule_id_fkey"
            columns: ["rent_schedule_id"]
            isOneToOne: false
            referencedRelation: "rent_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          display_order: number | null
          file_url: string
          id: string
          is_cover: boolean | null
          property_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          file_url: string
          id?: string
          is_cover?: boolean | null
          property_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          file_url?: string
          id?: string
          is_cover?: boolean | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line: string
          address_line2: string | null
          area_name: string | null
          asset_category: string | null
          bathrooms: number | null
          beds: number | null
          beneficial_override_notes: string | null
          beneficial_override_percent: number | null
          capital_invested_gbp: number | null
          co_alarm_required: boolean | null
          conservation_area: boolean
          country: string | null
          county: string | null
          created_at: string
          current_value_gbp: number | null
          epc_rating: string | null
          epc_required: boolean | null
          fire_alarm_grade: string | null
          formatted_address: string | null
          geocode_confidence: string | null
          geocode_error: string | null
          geocode_source: string | null
          geocode_status: string | null
          geocoded_at: string | null
          has_emergency_lighting: boolean | null
          has_fire_alarm_system: boolean | null
          has_gas: boolean | null
          has_solar: boolean | null
          heritage_notes: string | null
          id: string
          identity_updated_at: string | null
          identity_updated_by: string | null
          is_grade_listed: boolean | null
          is_hmo_licensed: boolean | null
          land_registry_link: string | null
          last_valuation_date: string | null
          last_valuation_estimate: number | null
          latitude: number | null
          lease_years_remaining: number | null
          legal_fees_gbp: number | null
          legal_owner_company_id: string | null
          legal_owner_party_id: string | null
          lifecycle_status_date: string | null
          lifecycle_type: string
          listed_status: string | null
          listing_grade: string | null
          listing_number: string | null
          longitude: number | null
          notes: string | null
          occupancy_status: string | null
          operational_date: string | null
          org_id: string
          original_purchase_date: string | null
          other_acquisition_costs_gbp: number | null
          ownership_entity: string | null
          ownership_percent: number | null
          place_id: string | null
          planning_authority: string | null
          postcode: string | null
          postcode_area: string | null
          property_name: string | null
          property_type: string | null
          purchase_price_gbp: number | null
          refurb_cost_gbp: number | null
          selective_licence_required: boolean | null
          solar_feed_in_tariff: boolean | null
          solar_install_date: string | null
          solar_installer_name: string | null
          solar_mcs_number: string | null
          solar_seg: boolean | null
          solar_system_size_kwp: number | null
          stamp_duty_gbp: number | null
          tenure: string | null
          title_number: string | null
          town_city: string | null
          updated_at: string
          uprn: string | null
          valuation_confidence: string | null
          value_change_percent: number | null
        }
        Insert: {
          address_line: string
          address_line2?: string | null
          area_name?: string | null
          asset_category?: string | null
          bathrooms?: number | null
          beds?: number | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          capital_invested_gbp?: number | null
          co_alarm_required?: boolean | null
          conservation_area?: boolean
          country?: string | null
          county?: string | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          fire_alarm_grade?: string | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          has_emergency_lighting?: boolean | null
          has_fire_alarm_system?: boolean | null
          has_gas?: boolean | null
          has_solar?: boolean | null
          heritage_notes?: string | null
          id?: string
          identity_updated_at?: string | null
          identity_updated_by?: string | null
          is_grade_listed?: boolean | null
          is_hmo_licensed?: boolean | null
          land_registry_link?: string | null
          last_valuation_date?: string | null
          last_valuation_estimate?: number | null
          latitude?: number | null
          lease_years_remaining?: number | null
          legal_fees_gbp?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          lifecycle_status_date?: string | null
          lifecycle_type?: string
          listed_status?: string | null
          listing_grade?: string | null
          listing_number?: string | null
          longitude?: number | null
          notes?: string | null
          occupancy_status?: string | null
          operational_date?: string | null
          org_id: string
          original_purchase_date?: string | null
          other_acquisition_costs_gbp?: number | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          planning_authority?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_name?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          refurb_cost_gbp?: number | null
          selective_licence_required?: boolean | null
          solar_feed_in_tariff?: boolean | null
          solar_install_date?: string | null
          solar_installer_name?: string | null
          solar_mcs_number?: string | null
          solar_seg?: boolean | null
          solar_system_size_kwp?: number | null
          stamp_duty_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
          valuation_confidence?: string | null
          value_change_percent?: number | null
        }
        Update: {
          address_line?: string
          address_line2?: string | null
          area_name?: string | null
          asset_category?: string | null
          bathrooms?: number | null
          beds?: number | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          capital_invested_gbp?: number | null
          co_alarm_required?: boolean | null
          conservation_area?: boolean
          country?: string | null
          county?: string | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          fire_alarm_grade?: string | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          has_emergency_lighting?: boolean | null
          has_fire_alarm_system?: boolean | null
          has_gas?: boolean | null
          has_solar?: boolean | null
          heritage_notes?: string | null
          id?: string
          identity_updated_at?: string | null
          identity_updated_by?: string | null
          is_grade_listed?: boolean | null
          is_hmo_licensed?: boolean | null
          land_registry_link?: string | null
          last_valuation_date?: string | null
          last_valuation_estimate?: number | null
          latitude?: number | null
          lease_years_remaining?: number | null
          legal_fees_gbp?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          lifecycle_status_date?: string | null
          lifecycle_type?: string
          listed_status?: string | null
          listing_grade?: string | null
          listing_number?: string | null
          longitude?: number | null
          notes?: string | null
          occupancy_status?: string | null
          operational_date?: string | null
          org_id?: string
          original_purchase_date?: string | null
          other_acquisition_costs_gbp?: number | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          planning_authority?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_name?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          refurb_cost_gbp?: number | null
          selective_licence_required?: boolean | null
          solar_feed_in_tariff?: boolean | null
          solar_install_date?: string | null
          solar_installer_name?: string | null
          solar_mcs_number?: string | null
          solar_seg?: boolean | null
          solar_system_size_kwp?: number | null
          stamp_duty_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
          valuation_confidence?: string | null
          value_change_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_legal_owner_company_id_fkey"
            columns: ["legal_owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_legal_owner_party_id_fkey"
            columns: ["legal_owner_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties_v2: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          asset_category: string | null
          beneficial_override_notes: string | null
          beneficial_override_percent: number | null
          city: string
          co_alarm_required: boolean | null
          conservation_area: boolean | null
          council_area: string | null
          council_name: string | null
          country: string | null
          county: string | null
          created_at: string | null
          current_valuation: number | null
          entity_id: string
          epc_expiry_date: string | null
          epc_rating: string | null
          epc_required: boolean | null
          fire_alarm_grade: string | null
          formatted_address: string | null
          geocode_confidence: string | null
          geocode_error: string | null
          geocode_source: string | null
          geocode_status: string | null
          geocoded_at: string | null
          has_emergency_lighting: boolean | null
          has_fire_alarm_system: boolean | null
          has_gas_supply: boolean | null
          has_solar: boolean | null
          id: string
          identity_updated_at: string | null
          identity_updated_by: string | null
          is_hmo_licensed: boolean | null
          latitude: number | null
          legal_owner_company_id: string | null
          legal_owner_party_id: string | null
          lifecycle_stage: string
          lifecycle_status_date: string | null
          listed_status: string | null
          listing_grade: string
          longitude: number | null
          notes: string | null
          occupancy_status: string | null
          operational_date: string | null
          org_id: string
          place_id: string | null
          planning_authority: string | null
          postcode: string
          property_name: string | null
          property_type: string
          purchase_date: string | null
          purchase_price: number | null
          rent_basis: string
          selective_licence_required: boolean | null
          tenure: string | null
          title_number: string | null
          total_floors: number | null
          total_lettable_rooms: number | null
          updated_at: string | null
          uprn: string | null
          valuation_date: string | null
          whole_house_rent_pcm: number | null
          year_built: number | null
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          asset_category?: string | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          city: string
          co_alarm_required?: boolean | null
          conservation_area?: boolean | null
          council_area?: string | null
          council_name?: string | null
          country?: string | null
          county?: string | null
          created_at?: string | null
          current_valuation?: number | null
          entity_id: string
          epc_expiry_date?: string | null
          epc_rating?: string | null
          epc_required?: boolean | null
          fire_alarm_grade?: string | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          has_emergency_lighting?: boolean | null
          has_fire_alarm_system?: boolean | null
          has_gas_supply?: boolean | null
          has_solar?: boolean | null
          id?: string
          identity_updated_at?: string | null
          identity_updated_by?: string | null
          is_hmo_licensed?: boolean | null
          latitude?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          lifecycle_stage?: string
          lifecycle_status_date?: string | null
          listed_status?: string | null
          listing_grade?: string
          longitude?: number | null
          notes?: string | null
          occupancy_status?: string | null
          operational_date?: string | null
          org_id: string
          place_id?: string | null
          planning_authority?: string | null
          postcode: string
          property_name?: string | null
          property_type: string
          purchase_date?: string | null
          purchase_price?: number | null
          rent_basis?: string
          selective_licence_required?: boolean | null
          tenure?: string | null
          title_number?: string | null
          total_floors?: number | null
          total_lettable_rooms?: number | null
          updated_at?: string | null
          uprn?: string | null
          valuation_date?: string | null
          whole_house_rent_pcm?: number | null
          year_built?: number | null
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          asset_category?: string | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          city?: string
          co_alarm_required?: boolean | null
          conservation_area?: boolean | null
          council_area?: string | null
          council_name?: string | null
          country?: string | null
          county?: string | null
          created_at?: string | null
          current_valuation?: number | null
          entity_id?: string
          epc_expiry_date?: string | null
          epc_rating?: string | null
          epc_required?: boolean | null
          fire_alarm_grade?: string | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          has_emergency_lighting?: boolean | null
          has_fire_alarm_system?: boolean | null
          has_gas_supply?: boolean | null
          has_solar?: boolean | null
          id?: string
          identity_updated_at?: string | null
          identity_updated_by?: string | null
          is_hmo_licensed?: boolean | null
          latitude?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          lifecycle_stage?: string
          lifecycle_status_date?: string | null
          listed_status?: string | null
          listing_grade?: string
          longitude?: number | null
          notes?: string | null
          occupancy_status?: string | null
          operational_date?: string | null
          org_id?: string
          place_id?: string | null
          planning_authority?: string | null
          postcode?: string
          property_name?: string | null
          property_type?: string
          purchase_date?: string | null
          purchase_price?: number | null
          rent_basis?: string
          selective_licence_required?: boolean | null
          tenure?: string | null
          title_number?: string | null
          total_floors?: number | null
          total_lettable_rooms?: number | null
          updated_at?: string | null
          uprn?: string | null
          valuation_date?: string | null
          whole_house_rent_pcm?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_v2_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "properties_v2_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_v2_legal_owner_company_id_fkey"
            columns: ["legal_owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_v2_legal_owner_party_id_fkey"
            columns: ["legal_owner_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_beneficial_owners: {
        Row: {
          beneficial_percent: number
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_type: string
          party_id: string | null
          property_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          beneficial_percent: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_type: string
          party_id?: string | null
          property_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          beneficial_percent?: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_type?: string
          party_id?: string | null
          property_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_beneficial_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_beneficial_owners_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_beneficial_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_legal_ownership: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_entity_id: string
          owner_percent: number
          owning_company_id: string | null
          property_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_entity_id: string
          owner_percent: number
          owning_company_id?: string | null
          property_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_entity_id?: string
          owner_percent?: number
          owning_company_id?: string | null
          property_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_legal_ownership_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "ownership_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_legal_ownership_owning_company_id_fkey"
            columns: ["owning_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_legal_ownership_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ownership: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          ownership_entity_id: string
          ownership_level: string
          ownership_percent: number
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          ownership_entity_id: string
          ownership_level?: string
          ownership_percent: number
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          ownership_entity_id?: string
          ownership_level?: string
          ownership_percent?: number
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ownership_ownership_entity_id_fkey"
            columns: ["ownership_entity_id"]
            isOneToOne: false
            referencedRelation: "ownership_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_ownership_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_passport: {
        Row: {
          access_ramp: boolean | null
          asset_agreement_category: string | null
          asset_performance_rating: string | null
          base_clarification: string | null
          basement: boolean | null
          block_communal_entrance: string | null
          built_in_year: number | null
          carport: boolean | null
          communal_tv_supply: boolean | null
          construction_date_band: string | null
          construction_type: string | null
          council_tax_band: string | null
          county: string | null
          created_at: string
          dropbox_link: string | null
          electric_meter_location: string | null
          electric_meter_number: string | null
          ensuites: number | null
          gas_meter_location: string | null
          gas_meter_number: string | null
          has_bin_store: boolean | null
          has_cycle_store: boolean | null
          has_gas_supply: boolean | null
          has_guest_room: boolean | null
          has_loft_access: boolean | null
          hmo_bed_spaces: number | null
          hmo_licence: boolean | null
          hmo_licence_expiry: string | null
          hmo_licence_number: string | null
          hmo_licence_required: boolean | null
          id: string
          keysafe_code: string | null
          kitchens: number | null
          living_rooms_communal: number | null
          local_authority: string | null
          local_authority_id: string | null
          local_authority_text: string | null
          loft_access: string | null
          maintenance_area: string | null
          management_company_id: string | null
          management_company_text: string | null
          number_of_storeys: number | null
          occupation_status: string | null
          oil_supplier: string | null
          oil_tank_capacity_litres: number | null
          oil_tank_location: string | null
          owned_by: string | null
          parking: string | null
          photographs_link: string | null
          postcode: string | null
          property_id: string
          property_management_company: string | null
          property_management_fee_percent: number | null
          town_city: string | null
          updated_at: string
          water_meter_location: string | null
          water_meter_number: string | null
          water_stop_tap_location: string | null
          wc_cloakroom: number | null
        }
        Insert: {
          access_ramp?: boolean | null
          asset_agreement_category?: string | null
          asset_performance_rating?: string | null
          base_clarification?: string | null
          basement?: boolean | null
          block_communal_entrance?: string | null
          built_in_year?: number | null
          carport?: boolean | null
          communal_tv_supply?: boolean | null
          construction_date_band?: string | null
          construction_type?: string | null
          council_tax_band?: string | null
          county?: string | null
          created_at?: string
          dropbox_link?: string | null
          electric_meter_location?: string | null
          electric_meter_number?: string | null
          ensuites?: number | null
          gas_meter_location?: string | null
          gas_meter_number?: string | null
          has_bin_store?: boolean | null
          has_cycle_store?: boolean | null
          has_gas_supply?: boolean | null
          has_guest_room?: boolean | null
          has_loft_access?: boolean | null
          hmo_bed_spaces?: number | null
          hmo_licence?: boolean | null
          hmo_licence_expiry?: string | null
          hmo_licence_number?: string | null
          hmo_licence_required?: boolean | null
          id?: string
          keysafe_code?: string | null
          kitchens?: number | null
          living_rooms_communal?: number | null
          local_authority?: string | null
          local_authority_id?: string | null
          local_authority_text?: string | null
          loft_access?: string | null
          maintenance_area?: string | null
          management_company_id?: string | null
          management_company_text?: string | null
          number_of_storeys?: number | null
          occupation_status?: string | null
          oil_supplier?: string | null
          oil_tank_capacity_litres?: number | null
          oil_tank_location?: string | null
          owned_by?: string | null
          parking?: string | null
          photographs_link?: string | null
          postcode?: string | null
          property_id: string
          property_management_company?: string | null
          property_management_fee_percent?: number | null
          town_city?: string | null
          updated_at?: string
          water_meter_location?: string | null
          water_meter_number?: string | null
          water_stop_tap_location?: string | null
          wc_cloakroom?: number | null
        }
        Update: {
          access_ramp?: boolean | null
          asset_agreement_category?: string | null
          asset_performance_rating?: string | null
          base_clarification?: string | null
          basement?: boolean | null
          block_communal_entrance?: string | null
          built_in_year?: number | null
          carport?: boolean | null
          communal_tv_supply?: boolean | null
          construction_date_band?: string | null
          construction_type?: string | null
          council_tax_band?: string | null
          county?: string | null
          created_at?: string
          dropbox_link?: string | null
          electric_meter_location?: string | null
          electric_meter_number?: string | null
          ensuites?: number | null
          gas_meter_location?: string | null
          gas_meter_number?: string | null
          has_bin_store?: boolean | null
          has_cycle_store?: boolean | null
          has_gas_supply?: boolean | null
          has_guest_room?: boolean | null
          has_loft_access?: boolean | null
          hmo_bed_spaces?: number | null
          hmo_licence?: boolean | null
          hmo_licence_expiry?: string | null
          hmo_licence_number?: string | null
          hmo_licence_required?: boolean | null
          id?: string
          keysafe_code?: string | null
          kitchens?: number | null
          living_rooms_communal?: number | null
          local_authority?: string | null
          local_authority_id?: string | null
          local_authority_text?: string | null
          loft_access?: string | null
          maintenance_area?: string | null
          management_company_id?: string | null
          management_company_text?: string | null
          number_of_storeys?: number | null
          occupation_status?: string | null
          oil_supplier?: string | null
          oil_tank_capacity_litres?: number | null
          oil_tank_location?: string | null
          owned_by?: string | null
          parking?: string | null
          photographs_link?: string | null
          postcode?: string | null
          property_id?: string
          property_management_company?: string | null
          property_management_fee_percent?: number | null
          town_city?: string | null
          updated_at?: string
          water_meter_location?: string | null
          water_meter_number?: string | null
          water_stop_tap_location?: string | null
          wc_cloakroom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_passport_local_authority_id_fkey"
            columns: ["local_authority_id"]
            isOneToOne: false
            referencedRelation: "local_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_passport_management_company_id_fkey"
            columns: ["management_company_id"]
            isOneToOne: false
            referencedRelation: "management_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_passport_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_title_numbers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          property_id: string
          title_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          property_id: string
          title_number: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          property_id?: string
          title_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_title_numbers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_valuations: {
        Row: {
          adjustment_factors: Json | null
          comparables_avg_price: number | null
          comparables_count: number | null
          comparables_max_price: number | null
          comparables_min_price: number | null
          confidence_level: string | null
          created_at: string
          estimated_value_gbp: number
          id: string
          notes: string | null
          org_id: string
          property_id: string
          valuation_date: string
          valuation_method: string
        }
        Insert: {
          adjustment_factors?: Json | null
          comparables_avg_price?: number | null
          comparables_count?: number | null
          comparables_max_price?: number | null
          comparables_min_price?: number | null
          confidence_level?: string | null
          created_at?: string
          estimated_value_gbp: number
          id?: string
          notes?: string | null
          org_id: string
          property_id: string
          valuation_date?: string
          valuation_method: string
        }
        Update: {
          adjustment_factors?: Json | null
          comparables_avg_price?: number | null
          comparables_count?: number | null
          comparables_max_price?: number | null
          comparables_min_price?: number | null
          confidence_level?: string | null
          created_at?: string
          estimated_value_gbp?: number
          id?: string
          notes?: string | null
          org_id?: string
          property_id?: string
          valuation_date?: string
          valuation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_valuations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      refinancing_opportunities: {
        Row: {
          completed_at: string | null
          created_at: string
          current_ltv: number
          current_mortgage_gbp: number
          current_value_gbp: number
          id: string
          identified_at: string
          notes: string | null
          org_id: string
          potential_release_gbp: number
          property_id: string
          reviewed_at: string | null
          status: string
          target_ltv: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_ltv: number
          current_mortgage_gbp: number
          current_value_gbp: number
          id?: string
          identified_at?: string
          notes?: string | null
          org_id: string
          potential_release_gbp: number
          property_id: string
          reviewed_at?: string | null
          status?: string
          target_ltv?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_ltv?: number
          current_mortgage_gbp?: number
          current_value_gbp?: number
          id?: string
          identified_at?: string
          notes?: string | null
          org_id?: string
          potential_release_gbp?: number
          property_id?: string
          reviewed_at?: string | null
          status?: string
          target_ltv?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refinancing_opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refinancing_opportunities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          agreement_id: string | null
          amount: number
          bank_transaction_id: string | null
          created_at: string
          id: string
          is_reconciled: boolean | null
          match_confidence: number | null
          notes: string | null
          org_id: string
          payment_date: string
          payment_method: string | null
          reconciliation_method: string | null
          recorded_by: string | null
          reference: string | null
          rent_schedule_id: string | null
          tenancy_id: string
        }
        Insert: {
          agreement_id?: string | null
          amount: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          is_reconciled?: boolean | null
          match_confidence?: number | null
          notes?: string | null
          org_id: string
          payment_date: string
          payment_method?: string | null
          reconciliation_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          rent_schedule_id?: string | null
          tenancy_id: string
        }
        Update: {
          agreement_id?: string | null
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          is_reconciled?: boolean | null
          match_confidence?: number | null
          notes?: string | null
          org_id?: string
          payment_date?: string
          payment_method?: string | null
          reconciliation_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          rent_schedule_id?: string | null
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "tenancy_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "tenancy_compliance_check_v2"
            referencedColumns: ["tenancy_id"]
          },
          {
            foreignKeyName: "rent_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_rent_schedule_id_fkey"
            columns: ["rent_schedule_id"]
            isOneToOne: false
            referencedRelation: "rent_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_schedule: {
        Row: {
          additional_charges: number | null
          agreement_id: string | null
          amount_outstanding: number | null
          amount_paid: number | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          org_id: string
          payment_reference: string | null
          period_end: string
          period_start: string
          reminder_sent_at: string | null
          rent_amount: number
          status: Database["public"]["Enums"]["rent_status"]
          tags: string[] | null
          tenancy_id: string
          updated_at: string
          warning_sent_at: string | null
        }
        Insert: {
          additional_charges?: number | null
          agreement_id?: string | null
          amount_outstanding?: number | null
          amount_paid?: number | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          org_id: string
          payment_reference?: string | null
          period_end: string
          period_start: string
          reminder_sent_at?: string | null
          rent_amount: number
          status?: Database["public"]["Enums"]["rent_status"]
          tags?: string[] | null
          tenancy_id: string
          updated_at?: string
          warning_sent_at?: string | null
        }
        Update: {
          additional_charges?: number | null
          agreement_id?: string | null
          amount_outstanding?: number | null
          amount_paid?: number | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          org_id?: string
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          reminder_sent_at?: string | null
          rent_amount?: number
          status?: Database["public"]["Enums"]["rent_status"]
          tags?: string[] | null
          tenancy_id?: string
          updated_at?: string
          warning_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_schedule_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "tenancy_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_schedule_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "tenancy_compliance_check_v2"
            referencedColumns: ["tenancy_id"]
          },
          {
            foreignKeyName: "rent_schedule_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_schedule_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          amenities: string[] | null
          created_at: string
          description: string | null
          floor: number | null
          id: string
          org_id: string
          photos: string[] | null
          property_id: string
          room_name: string
          room_number: string | null
          room_type: Database["public"]["Enums"]["room_type"]
          square_footage: number | null
          status: Database["public"]["Enums"]["room_status"]
          target_rent_pcm: number | null
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          created_at?: string
          description?: string | null
          floor?: number | null
          id?: string
          org_id: string
          photos?: string[] | null
          property_id: string
          room_name: string
          room_number?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          square_footage?: number | null
          status?: Database["public"]["Enums"]["room_status"]
          target_rent_pcm?: number | null
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          created_at?: string
          description?: string | null
          floor?: number | null
          id?: string
          org_id?: string
          photos?: string[] | null
          property_id?: string
          room_name?: string
          room_number?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          square_footage?: number | null
          status?: Database["public"]["Enums"]["room_status"]
          target_rent_pcm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms_v2: {
        Row: {
          created_at: string | null
          current_rent_pcm: number | null
          floor: number | null
          has_ensuite: boolean | null
          id: string
          is_lettable: boolean | null
          notes: string | null
          occupancy_status: string
          property_id: string
          room_name: string
          room_type: string
          target_rent_pcm: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_rent_pcm?: number | null
          floor?: number | null
          has_ensuite?: boolean | null
          id?: string
          is_lettable?: boolean | null
          notes?: string | null
          occupancy_status?: string
          property_id: string
          room_name: string
          room_type: string
          target_rent_pcm?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_rent_pcm?: number | null
          floor?: number | null
          has_ensuite?: boolean | null
          id?: string
          is_lettable?: boolean | null
          notes?: string | null
          occupancy_status?: string
          property_id?: string
          room_name?: string
          room_type?: string
          target_rent_pcm?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      scheduled_email_runs: {
        Row: {
          created_at: string
          email_subject: string | null
          error: string | null
          id: string
          org_id: string | null
          provider_message_id: string | null
          recipient_email: string | null
          run_key: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email_subject?: string | null
          error?: string | null
          id?: string
          org_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          run_key: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email_subject?: string | null
          error?: string | null
          id?: string
          org_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          run_key?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_email_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          created_at: string
          dedup_key: string
          id: string
          notification_type: string
          org_id: string
          processed: boolean
          processed_at: string | null
          reference_id: string | null
          reference_type: string | null
          scheduled_for: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          id?: string
          notification_type: string
          org_id: string
          processed?: boolean
          processed_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          scheduled_for: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          id?: string
          notification_type?: string
          org_id?: string
          processed?: boolean
          processed_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          scheduled_for?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      share_classes: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          id: string
          is_primary: boolean | null
          issued_shares: number
          name: string
          nominal_value: number | null
          shares_confirmed: boolean | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          issued_shares?: number
          name?: string
          nominal_value?: number | null
          shares_confirmed?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          issued_shares?: number
          name?: string
          nominal_value?: number | null
          shares_confirmed?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_classes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      share_classes_v2: {
        Row: {
          class_name: string
          created_at: string | null
          currency: string | null
          dividend_rights: boolean
          entity_id: string
          id: string
          is_primary: boolean | null
          issued_shares: number
          nominal_value: number | null
          notes: string | null
          org_id: string | null
          total_authorised: number | null
          updated_at: string | null
          voting_rights: boolean | null
        }
        Insert: {
          class_name?: string
          created_at?: string | null
          currency?: string | null
          dividend_rights?: boolean
          entity_id: string
          id?: string
          is_primary?: boolean | null
          issued_shares?: number
          nominal_value?: number | null
          notes?: string | null
          org_id?: string | null
          total_authorised?: number | null
          updated_at?: string | null
          voting_rights?: boolean | null
        }
        Update: {
          class_name?: string
          created_at?: string | null
          currency?: string | null
          dividend_rights?: boolean
          entity_id?: string
          id?: string
          is_primary?: boolean | null
          issued_shares?: number
          nominal_value?: number | null
          notes?: string | null
          org_id?: string | null
          total_authorised?: number | null
          updated_at?: string | null
          voting_rights?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "share_classes_v2_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "share_classes_v2_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_classes_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholder_access: {
        Row: {
          access_level: string
          can_view_compliance: boolean
          can_view_documents: boolean
          can_view_financials: boolean
          created_at: string
          id: string
          invite_id: string | null
          last_accessed_at: string | null
          org_id: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          can_view_compliance?: boolean
          can_view_documents?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          invite_id?: string | null
          last_accessed_at?: string | null
          org_id: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          can_view_compliance?: boolean
          can_view_documents?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          invite_id?: string | null
          last_accessed_at?: string | null
          org_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholder_access_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "shareholder_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholder_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholder_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string | null
          org_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          name?: string | null
          org_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          org_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholder_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholdings: {
        Row: {
          company_id: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          ownership_source: string
          share_class_id: string
          shareholder_party_id: string
          shares_held: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          ownership_source?: string
          share_class_id: string
          shareholder_party_id: string
          shares_held: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          ownership_source?: string
          share_class_id?: string
          shareholder_party_id?: string
          shares_held?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholdings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholdings_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholdings_shareholder_party_id_fkey"
            columns: ["shareholder_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category: string
          completed_at: string | null
          compliance_requirement_id: string | null
          created_at: string
          created_by: string
          description: string | null
          dismissed_reason: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          org_id: string
          priority: string
          property_id: string | null
          source: string
          source_wizard_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          completed_at?: string | null
          compliance_requirement_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          org_id: string
          priority?: string
          property_id?: string | null
          source?: string
          source_wizard_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          compliance_requirement_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          org_id?: string
          priority?: string
          property_id?: string | null
          source?: string
          source_wizard_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_compliance_requirement_id_fkey"
            columns: ["compliance_requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_matrix_v2"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "tasks_compliance_requirement_id_fkey"
            columns: ["compliance_requirement_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "tasks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tasks_source_wizard_id_fkey"
            columns: ["source_wizard_id"]
            isOneToOne: false
            referencedRelation: "wizard_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_year_summaries: {
        Row: {
          basic_rate_tax_reduction: number | null
          created_at: string | null
          entity_id: string
          finance_costs: number | null
          id: string
          is_locked: boolean | null
          net_rental_profit: number | null
          notes: string | null
          org_id: string | null
          tax_year: string
          tax_year_end: string
          tax_year_start: string
          total_allowable_expenses: number | null
          total_council_tax: number | null
          total_insurance: number | null
          total_licensing: number | null
          total_management_fees: number | null
          total_mortgage_interest: number | null
          total_other_expenses: number | null
          total_other_income: number | null
          total_professional_fees: number | null
          total_rental_income: number | null
          total_repairs_maintenance: number | null
          total_utilities: number | null
          updated_at: string | null
        }
        Insert: {
          basic_rate_tax_reduction?: number | null
          created_at?: string | null
          entity_id: string
          finance_costs?: number | null
          id?: string
          is_locked?: boolean | null
          net_rental_profit?: number | null
          notes?: string | null
          org_id?: string | null
          tax_year: string
          tax_year_end: string
          tax_year_start: string
          total_allowable_expenses?: number | null
          total_council_tax?: number | null
          total_insurance?: number | null
          total_licensing?: number | null
          total_management_fees?: number | null
          total_mortgage_interest?: number | null
          total_other_expenses?: number | null
          total_other_income?: number | null
          total_professional_fees?: number | null
          total_rental_income?: number | null
          total_repairs_maintenance?: number | null
          total_utilities?: number | null
          updated_at?: string | null
        }
        Update: {
          basic_rate_tax_reduction?: number | null
          created_at?: string | null
          entity_id?: string
          finance_costs?: number | null
          id?: string
          is_locked?: boolean | null
          net_rental_profit?: number | null
          notes?: string | null
          org_id?: string | null
          tax_year?: string
          tax_year_end?: string
          tax_year_start?: string
          total_allowable_expenses?: number | null
          total_council_tax?: number | null
          total_insurance?: number | null
          total_licensing?: number | null
          total_management_fees?: number | null
          total_mortgage_interest?: number | null
          total_other_expenses?: number | null
          total_other_income?: number | null
          total_professional_fees?: number | null
          total_rental_income?: number | null
          total_repairs_maintenance?: number | null
          total_utilities?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_year_summaries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "tax_year_summaries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_year_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string | null
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          name?: string | null
          org_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancies: {
        Row: {
          created_at: string
          deposit_amount: number | null
          deposit_protected_date: string | null
          deposit_reference: string | null
          deposit_scheme: string | null
          end_date: string | null
          id: string
          notes: string | null
          notice_date: string | null
          notice_period_weeks: number | null
          org_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          property_id: string
          rent_amount_pcm: number
          rent_due_day: number
          room_id: string
          start_date: string
          status: Database["public"]["Enums"]["tenancy_status"]
          tenancy_agreement_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number | null
          deposit_protected_date?: string | null
          deposit_reference?: string | null
          deposit_scheme?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          notice_date?: string | null
          notice_period_weeks?: number | null
          org_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          property_id: string
          rent_amount_pcm: number
          rent_due_day?: number
          room_id: string
          start_date: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          tenancy_agreement_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number | null
          deposit_protected_date?: string | null
          deposit_reference?: string | null
          deposit_scheme?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          notice_date?: string | null
          notice_period_weeks?: number | null
          org_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          property_id?: string
          rent_amount_pcm?: number
          rent_due_day?: number
          room_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          tenancy_agreement_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_agreements: {
        Row: {
          actual_end_date: string | null
          break_clause_date: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_protected_date: string | null
          deposit_reference: string | null
          deposit_scheme: string | null
          how_to_rent_served_date: string | null
          id: string
          initial_end_date: string | null
          is_periodic: boolean | null
          last_rent_review_amount: number | null
          last_rent_review_date: string | null
          notes: string | null
          notice_served_date: string | null
          notice_type: string | null
          org_id: string
          prescribed_info_served_date: string | null
          property_id: string
          rent_amount_pcm: number
          rent_frequency: string
          room_id: string
          start_date: string
          status: string
          tenancy_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          actual_end_date?: string | null
          break_clause_date?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_protected_date?: string | null
          deposit_reference?: string | null
          deposit_scheme?: string | null
          how_to_rent_served_date?: string | null
          id?: string
          initial_end_date?: string | null
          is_periodic?: boolean | null
          last_rent_review_amount?: number | null
          last_rent_review_date?: string | null
          notes?: string | null
          notice_served_date?: string | null
          notice_type?: string | null
          org_id: string
          prescribed_info_served_date?: string | null
          property_id: string
          rent_amount_pcm: number
          rent_frequency?: string
          room_id: string
          start_date: string
          status?: string
          tenancy_type?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          actual_end_date?: string | null
          break_clause_date?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_protected_date?: string | null
          deposit_reference?: string | null
          deposit_scheme?: string | null
          how_to_rent_served_date?: string | null
          id?: string
          initial_end_date?: string | null
          is_periodic?: boolean | null
          last_rent_review_amount?: number | null
          last_rent_review_date?: string | null
          notes?: string | null
          notice_served_date?: string | null
          notice_type?: string | null
          org_id?: string
          prescribed_info_served_date?: string | null
          property_id?: string
          rent_amount_pcm?: number
          rent_frequency?: string
          room_id?: string
          start_date?: string
          status?: string
          tenancy_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tenancy_agreements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_compliance_items: {
        Row: {
          completed_by: string | null
          completed_date: string | null
          created_at: string
          document_url: string | null
          due_date: string | null
          id: string
          is_applicable: boolean
          is_required: boolean
          item_type: string
          label: string
          notes: string | null
          org_id: string
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          is_applicable?: boolean
          is_required?: boolean
          item_type: string
          label: string
          notes?: string | null
          org_id: string
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          is_applicable?: boolean
          is_required?: boolean
          item_type?: string
          label?: string
          notes?: string | null
          org_id?: string
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_compliance_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_compliance_items_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_portal_access: {
        Row: {
          can_submit_maintenance: boolean
          can_view_documents: boolean
          can_view_rent: boolean
          granted_at: string
          id: string
          invite_id: string | null
          org_id: string
          revoked_at: string | null
          tenancy_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          can_submit_maintenance?: boolean
          can_view_documents?: boolean
          can_view_rent?: boolean
          granted_at?: string
          id?: string
          invite_id?: string | null
          org_id: string
          revoked_at?: string | null
          tenancy_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          can_submit_maintenance?: boolean
          can_view_documents?: boolean
          can_view_rent?: boolean
          granted_at?: string
          id?: string
          invite_id?: string | null
          org_id?: string
          revoked_at?: string | null
          tenancy_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_portal_access_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "tenant_portal_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_portal_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_portal_access_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_portal_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_portal_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          tenancy_id: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          tenancy_id: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          tenancy_id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_portal_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_portal_invites_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_portal_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          annual_income: number | null
          company_contact_email: string | null
          company_contact_name: string | null
          company_contact_phone: string | null
          company_contact_role: string | null
          company_name: string | null
          company_number: string | null
          company_registered_address: string | null
          compliance_contact_email: string | null
          compliance_contact_name: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employer_address: string | null
          employer_name: string | null
          employment_status: string | null
          first_name: string | null
          guarantor_address: string | null
          guarantor_email: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          id: string
          last_name: string | null
          national_insurance: string | null
          notes: string | null
          org_id: string
          phone: string | null
          portal_user_id: string | null
          previous_address: string | null
          previous_landlord_name: string | null
          previous_landlord_phone: string | null
          reference_notes: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          tenant_type: string
          trading_name: string | null
          updated_at: string
          vat_number: string | null
          vat_registered: boolean | null
        }
        Insert: {
          annual_income?: number | null
          company_contact_email?: string | null
          company_contact_name?: string | null
          company_contact_phone?: string | null
          company_contact_role?: string | null
          company_name?: string | null
          company_number?: string | null
          company_registered_address?: string | null
          compliance_contact_email?: string | null
          compliance_contact_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          guarantor_address?: string | null
          guarantor_email?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          last_name?: string | null
          national_insurance?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          portal_user_id?: string | null
          previous_address?: string | null
          previous_landlord_name?: string | null
          previous_landlord_phone?: string | null
          reference_notes?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          tenant_type?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Update: {
          annual_income?: number | null
          company_contact_email?: string | null
          company_contact_name?: string | null
          company_contact_phone?: string | null
          company_contact_role?: string | null
          company_name?: string | null
          company_number?: string | null
          company_registered_address?: string | null
          compliance_contact_email?: string | null
          compliance_contact_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          guarantor_address?: string | null
          guarantor_email?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          last_name?: string | null
          national_insurance?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          portal_user_id?: string | null
          previous_address?: string | null
          previous_landlord_name?: string | null
          previous_landlord_phone?: string | null
          reference_notes?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          tenant_type?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants_v2: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          national_insurance: string | null
          notes: string | null
          org_id: string
          phone: string | null
          referral_source: string | null
          status: string
          tenant_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          national_insurance?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          referral_source?: string | null
          status?: string
          tenant_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          national_insurance?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          referral_source?: string | null
          status?: string
          tenant_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_alerts: {
        Row: {
          alert_type: string
          change_percent: number | null
          created_at: string
          estimated_value_gbp: number | null
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          org_id: string
          property_id: string
          recorded_value_gbp: number | null
          title: string
        }
        Insert: {
          alert_type: string
          change_percent?: number | null
          created_at?: string
          estimated_value_gbp?: number | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          org_id: string
          property_id: string
          recorded_value_gbp?: number | null
          title: string
        }
        Update: {
          alert_type?: string
          change_percent?: number | null
          created_at?: string
          estimated_value_gbp?: number | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          org_id?: string
          property_id?: string
          recorded_value_gbp?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      void_periods: {
        Row: {
          created_at: string
          end_date: string | null
          estimated_monthly_cost: number | null
          id: string
          org_id: string
          property_id: string
          reason: string | null
          reason_notes: string | null
          room_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          estimated_monthly_cost?: number | null
          id?: string
          org_id: string
          property_id: string
          reason?: string | null
          reason_notes?: string | null
          room_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          estimated_monthly_cost?: number | null
          id?: string
          org_id?: string
          property_id?: string
          reason?: string | null
          reason_notes?: string | null
          room_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "void_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_periods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_periods_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_drafts: {
        Row: {
          created_at: string
          current_step: number
          entity_id: string | null
          id: string
          org_id: string
          payload: Json
          property_id: string | null
          status: string
          updated_at: string
          user_id: string
          wizard_type: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          entity_id?: string | null
          id?: string
          org_id: string
          payload?: Json
          property_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wizard_type: string
        }
        Update: {
          created_at?: string
          current_step?: number
          entity_id?: string | null
          id?: string
          org_id?: string
          payload?: Json
          property_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wizard_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wizard_drafts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "wizard_drafts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizard_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizard_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizard_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      work_order_costs: {
        Row: {
          amount: number
          category: string
          contractor_job_id: string | null
          created_at: string
          description: string
          id: string
          invoice_reference: string | null
          is_estimated: boolean
          org_id: string
          receipt_url: string | null
          vat_amount: number | null
          work_order_id: string
        }
        Insert: {
          amount: number
          category?: string
          contractor_job_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_reference?: string | null
          is_estimated?: boolean
          org_id: string
          receipt_url?: string | null
          vat_amount?: number | null
          work_order_id: string
        }
        Update: {
          amount?: number
          category?: string
          contractor_job_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_reference?: string | null
          is_estimated?: boolean
          org_id?: string
          receipt_url?: string | null
          vat_amount?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_costs_contractor_job_id_fkey"
            columns: ["contractor_job_id"]
            isOneToOne: false
            referencedRelation: "contractor_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_costs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_completion_date: string | null
          actual_cost: number | null
          actual_start_date: string | null
          approved_at: string | null
          approved_budget: number | null
          approved_by: string | null
          category: string
          created_at: string
          description: string | null
          entity_id: string
          estimated_cost: number | null
          id: string
          internal_notes: string | null
          invoice_amount: number | null
          invoice_date: string | null
          invoice_reference: string | null
          maintenance_request_id: string | null
          org_id: string
          payment_status: string | null
          priority: string
          property_id: string | null
          raised_by: string | null
          rejected_reason: string | null
          room_id: string | null
          status: string
          target_completion_date: string | null
          target_start_date: string | null
          title: string
          updated_at: string
          wo_number: string
        }
        Insert: {
          actual_completion_date?: string | null
          actual_cost?: number | null
          actual_start_date?: string | null
          approved_at?: string | null
          approved_budget?: number | null
          approved_by?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id: string
          estimated_cost?: number | null
          id?: string
          internal_notes?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_reference?: string | null
          maintenance_request_id?: string | null
          org_id: string
          payment_status?: string | null
          priority?: string
          property_id?: string | null
          raised_by?: string | null
          rejected_reason?: string | null
          room_id?: string | null
          status?: string
          target_completion_date?: string | null
          target_start_date?: string | null
          title: string
          updated_at?: string
          wo_number: string
        }
        Update: {
          actual_completion_date?: string | null
          actual_cost?: number | null
          actual_start_date?: string | null
          approved_at?: string | null
          approved_budget?: number | null
          approved_by?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          estimated_cost?: number | null
          id?: string
          internal_notes?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_reference?: string | null
          maintenance_request_id?: string | null
          org_id?: string
          payment_status?: string | null
          priority?: string
          property_id?: string | null
          raised_by?: string | null
          rejected_reason?: string | null
          room_id?: string | null
          status?: string
          target_completion_date?: string | null
          target_start_date?: string | null
          title?: string
          updated_at?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "work_orders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_overview"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "work_orders_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      works_orders: {
        Row: {
          after_photo_urls: string[] | null
          approval_date: string | null
          approved_amount: number | null
          before_photo_urls: string[] | null
          completion_date: string | null
          completion_notes: string | null
          completion_photo_urls: string[] | null
          contractor_email_override: string | null
          contractor_id: string | null
          contractor_name_override: string | null
          contractor_phone_override: string | null
          created_at: string
          description: string
          id: string
          invoice_amount: number | null
          invoice_date: string | null
          invoice_reference: string | null
          maintenance_request_id: string
          notes: string | null
          order_number: string | null
          org_id: string
          paid_amount: number | null
          paid_date: string | null
          payment_method: string | null
          property_id: string
          quote_date: string | null
          quoted_amount: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          scheduled_time_slot: string | null
          status: string
          tenant_access_required: boolean | null
          tenant_notification_date: string | null
          tenant_notified: boolean | null
          updated_at: string
          warranty_expiry: string | null
          warranty_months: number | null
        }
        Insert: {
          after_photo_urls?: string[] | null
          approval_date?: string | null
          approved_amount?: number | null
          before_photo_urls?: string[] | null
          completion_date?: string | null
          completion_notes?: string | null
          completion_photo_urls?: string[] | null
          contractor_email_override?: string | null
          contractor_id?: string | null
          contractor_name_override?: string | null
          contractor_phone_override?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_reference?: string | null
          maintenance_request_id: string
          notes?: string | null
          order_number?: string | null
          org_id: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          property_id: string
          quote_date?: string | null
          quoted_amount?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scheduled_time_slot?: string | null
          status?: string
          tenant_access_required?: boolean | null
          tenant_notification_date?: string | null
          tenant_notified?: boolean | null
          updated_at?: string
          warranty_expiry?: string | null
          warranty_months?: number | null
        }
        Update: {
          after_photo_urls?: string[] | null
          approval_date?: string | null
          approved_amount?: number | null
          before_photo_urls?: string[] | null
          completion_date?: string | null
          completion_notes?: string | null
          completion_photo_urls?: string[] | null
          contractor_email_override?: string | null
          contractor_id?: string | null
          contractor_name_override?: string | null
          contractor_phone_override?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_reference?: string | null
          maintenance_request_id?: string
          notes?: string | null
          order_number?: string | null
          org_id?: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          property_id?: string
          quote_date?: string | null
          quoted_amount?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scheduled_time_slot?: string | null
          status?: string
          tenant_access_required?: boolean | null
          tenant_notification_date?: string | null
          tenant_notified?: boolean | null
          updated_at?: string
          warranty_expiry?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "works_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "compliance_contractors_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_maintenance_performance"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "works_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_overview"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "works_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_secrets_masked: {
        Row: {
          auth_code_last4: string | null
          auth_code_masked: string | null
          company_id: string | null
          updated_at: string | null
          utr_last4: string | null
          utr_masked: string | null
        }
        Insert: {
          auth_code_last4?: string | null
          auth_code_masked?: never
          company_id?: string | null
          updated_at?: string | null
          utr_last4?: string | null
          utr_masked?: never
        }
        Update: {
          auth_code_last4?: string | null
          auth_code_masked?: never
          company_id?: string | null
          updated_at?: string | null
          utr_last4?: string | null
          utr_masked?: never
        }
        Relationships: [
          {
            foreignKeyName: "company_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_matrix_v2: {
        Row: {
          ai_extracted: boolean | null
          calculated_status: string | null
          certificate_number: string | null
          cost: number | null
          days_remaining: number | null
          document_id: string | null
          document_notes: string | null
          document_type: string | null
          entity_name: string | null
          expiry_date: string | null
          file_url: string | null
          is_required: boolean | null
          issue_date: string | null
          issuer_name: string | null
          lead_time_days: number | null
          org_id: string | null
          override_reason: string | null
          property_address: string | null
          property_id: string | null
          property_type: string | null
          requirement_id: string | null
          review_frequency_months: number | null
          urgency_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_v2_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_task_overview: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          contractor_id: string | null
          contractor_name: string | null
          created_at: string | null
          days_until_due: number | null
          document_type: string | null
          due_date: string | null
          entity_name: string | null
          escalation_level: number | null
          inspection_date: string | null
          is_overdue: boolean | null
          last_escalated_at: string | null
          notes: string | null
          org_id: string | null
          priority: string | null
          property_address: string | null
          property_id: string | null
          quoted_cost: number | null
          resolution_notes: string | null
          resolved_at: string | null
          source: string | null
          status: string | null
          task_id: string | null
          task_type: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "compliance_contractors_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_maintenance_performance"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "compliance_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      contractor_maintenance_performance: {
        Row: {
          avg_days_over_schedule: number | null
          avg_job_cost: number | null
          avg_report_to_completion_days: number | null
          company_name: string | null
          completed_jobs: number | null
          contractor_id: string | null
          disputed_jobs: number | null
          org_id: string | null
          rating: number | null
          service_types: string[] | null
          total_jobs: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_contractors_v2_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_financial_summary: {
        Row: {
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          org_id: string | null
          property_count: number | null
          snapshot_month: string | null
          total_cash_flow: number | null
          total_costs: number | null
          total_mortgage_payments: number | null
          total_noi: number | null
          total_rent_received: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "financial_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_verification_status: {
        Row: {
          accounts_filing_status: string | null
          ch_accounts_next_due: string | null
          ch_address_line_1: string | null
          ch_company_name: string | null
          ch_company_status: string | null
          ch_confirmation_next_due: string | null
          ch_has_charges: string | null
          ch_incorporation_date: string | null
          ch_postcode: string | null
          company_number: string | null
          confirmation_filing_status: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          last_synced: string | null
          local_incorporation_date: string | null
          local_registered_address: string | null
          local_status: string | null
          org_id: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_commitment_detail: {
        Row: {
          commitment_date: string | null
          commitment_id: string | null
          commitment_type: string | null
          committed_amount: number | null
          coupon_rate: number | null
          documentation_url: string | null
          drawn_amount: number | null
          entity_id: string | null
          entity_name: string | null
          entity_total_valuation: number | null
          entity_type: string | null
          equity_percentage: number | null
          investor_id: string | null
          investor_name: string | null
          investors_share_valuation: number | null
          maturity_date: string | null
          notes: string | null
          org_id: string | null
          payment_frequency: string | null
          property_count: number | null
          status: string | null
          total_distributions_received: number | null
          undrawn_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_summary"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_portfolio_summary: {
        Row: {
          distribution_multiple: number | null
          email: string | null
          entities_invested: number | null
          investor_id: string | null
          investor_name: string | null
          investor_type: string | null
          org_id: string | null
          portal_access_enabled: boolean | null
          total_capital_returned: number | null
          total_commitments: number | null
          total_committed: number | null
          total_distributed: number | null
          total_dividends: number | null
          total_drawn: number | null
          total_interest: number | null
          total_undrawn: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_return_metrics: {
        Row: {
          capital_invested: number | null
          cash_on_cash_pct: number | null
          commitment_id: string | null
          current_equity_value: number | null
          entity_id: string | null
          entity_name: string | null
          equity_multiple: number | null
          investor_id: string | null
          investor_name: string | null
          org_id: string | null
          total_distributions: number | null
          unrealised_gain_loss: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_verification_status"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "investor_commitments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_summary"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_commitments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_alerts: {
        Row: {
          covenant_icr_min: number | null
          covenant_ltv_max: number | null
          current_balance: number | null
          current_ltv: number | null
          days_to_erc_end: number | null
          days_to_rate_expiry: number | null
          days_to_term_end: number | null
          early_repayment_charge_until: string | null
          erc_alert: string | null
          facility_type: string | null
          interest_rate: number | null
          lender_name: string | null
          loan_id: string | null
          ltv_covenant_alert: string | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          rate_alert: string | null
          rate_expiry_date: string | null
          rate_type: string | null
          revert_rate: number | null
          term_alert: string | null
          term_end_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_facilities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      maintenance_overview: {
        Row: {
          approved_amount: number | null
          category: string | null
          comment_count: number | null
          completion_date: string | null
          contractor_id: string | null
          contractor_name: string | null
          days_open: number | null
          description: string | null
          invoice_amount: number | null
          is_emergency: boolean | null
          is_recurring: boolean | null
          order_number: string | null
          org_id: string | null
          priority: string | null
          property_address: string | null
          property_id: string | null
          quoted_amount: number | null
          reported_by: string | null
          reported_date: string | null
          request_id: string | null
          room_id: string | null
          room_name: string | null
          scheduled_date: string | null
          status: string | null
          tenant_id: string | null
          tenant_name: string | null
          title: string | null
          works_order_id: string | null
          works_order_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "compliance_contractors_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_maintenance_performance"
            referencedColumns: ["contractor_id"]
          },
        ]
      }
      maintenance_spend_by_category: {
        Row: {
          avg_cost: number | null
          avg_resolution_days: number | null
          category: string | null
          job_count: number | null
          org_id: string | null
          total_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_spend_by_property: {
        Row: {
          avg_days_to_complete: number | null
          avg_job_cost: number | null
          completed_jobs: number | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          total_invoiced: number | null
          total_jobs: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "works_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_compliance_score_v2: {
        Row: {
          compliance_score_pct: number | null
          total_critical: number | null
          total_expired: number | null
          total_expiring_soon: number | null
          total_missing: number | null
          total_required: number | null
          total_valid: number | null
        }
        Relationships: []
      }
      portfolio_debt_summary: {
        Row: {
          avg_interest_rate: number | null
          facility_count: number | null
          fixed_balance: number | null
          fixed_count: number | null
          lender_id: string | null
          lender_name: string | null
          lender_type: string | null
          nearest_rate_expiry: string | null
          nearest_term_end: string | null
          org_id: string | null
          total_exposure: number | null
          total_monthly_payments: number | null
          variable_balance: number | null
          variable_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lenders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_monthly_summary: {
        Row: {
          avg_occupancy_rate: number | null
          org_id: string | null
          portfolio_collection_rate: number | null
          portfolio_ltv: number | null
          property_count: number | null
          snapshot_month: string | null
          total_cash_flow: number | null
          total_costs: number | null
          total_debt: number | null
          total_equity: number | null
          total_mortgage_payments: number | null
          total_noi: number | null
          total_rent_due: number | null
          total_rent_received: number | null
          total_valuation: number | null
          total_void_loss: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_annual_performance: {
        Row: {
          annual_cash_flow: number | null
          annual_costs: number | null
          annual_mortgage_payments: number | null
          annual_noi: number | null
          annual_rent_received: number | null
          avg_collection_rate: number | null
          avg_occupancy: number | null
          cash_on_cash_return_pct: number | null
          current_valuation: number | null
          entity_name: string | null
          net_yield_pct: number | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          purchase_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_room_summary_v2: {
        Row: {
          gross_rent_pcm: number | null
          potential_rent_pcm: number | null
          property_id: string | null
          total_lettable: number | null
          total_occupied: number | null
        }
        Relationships: []
      }
      recurring_issue_detection: {
        Row: {
          category: string | null
          first_reported: string | null
          last_reported: string | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          request_count: number | null
          total_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_compliance_check_v2: {
        Row: {
          deposit_amount: number | null
          deposit_compliance: string | null
          deposit_protected_date: string | null
          deposit_scheme: string | null
          how_to_rent_compliance: string | null
          how_to_rent_served_date: string | null
          org_id: string | null
          prescribed_info_served_date: string | null
          property_id: string | null
          room_id: string | null
          section_21_ready: boolean | null
          status: string | null
          tenancy_id: string | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tenancy_agreements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      unread_notifications_v2: {
        Row: {
          channel: string | null
          compliance_task_id: string | null
          document_type: string | null
          id: string | null
          message: string | null
          metadata: Json | null
          notification_type: string | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          read_at: string | null
          recipient: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          task_priority: string | null
          task_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notifications_compliance_task_id_fkey"
            columns: ["compliance_task_id"]
            isOneToOne: false
            referencedRelation: "compliance_task_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "compliance_notifications_compliance_task_id_fkey"
            columns: ["compliance_task_id"]
            isOneToOne: false
            referencedRelation: "compliance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_room_summary_v2"
            referencedColumns: ["property_id"]
          },
        ]
      }
    }
    Functions: {
      accept_team_invite: { Args: { p_token: string }; Returns: Json }
      bulk_update_rent_schedule_status: {
        Args: { p_ids: string[]; p_notes?: string; p_status: string }
        Returns: undefined
      }
      cancel_renewed_compliance_jobs: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_jobs_for_expiring_compliance: { Args: never; Returns: number }
      find_matching_contractors: {
        Args: {
          p_compliance_type: string
          p_org_id: string
          p_postcode: string
        }
        Returns: {
          average_rating: number
          company_name: string
          contractor_id: string
          email: string
          match_score: number
          name: string
          phone: string
          total_jobs: number
          typical_cost: number
        }[]
      }
      generate_compliance_requirements_v2: {
        Args: { target_property_id: string }
        Returns: undefined
      }
      generate_rent_schedule:
        | { Args: { p_months?: number; p_tenancy_id: string }; Returns: number }
        | {
            Args: {
              p_agreement_id?: string
              p_months?: number
              p_tenancy_id: string
            }
            Returns: number
          }
      generate_tax_year_summary: {
        Args: {
          target_entity_id: string
          target_org_id: string
          target_tax_year: string
        }
        Returns: string
      }
      generate_tenancy_compliance_items: {
        Args: { tenancy_row: Database["public"]["Tables"]["tenancies"]["Row"] }
        Returns: undefined
      }
      generate_wo_number: {
        Args: { p_entity_id: string; p_org_id: string }
        Returns: string
      }
      generate_works_order_number: { Args: never; Returns: string }
      get_tenant_org_id: { Args: never; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_rent_schedule_item:
        | {
            Args: {
              p_additional_charges?: number
              p_amount_outstanding?: number
              p_amount_paid?: number
              p_due_date: string
              p_notes?: string
              p_org_id: string
              p_payment_reference?: string
              p_period_end: string
              p_period_start: string
              p_rent_amount: number
              p_status?: string
              p_tenancy_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_additional_charges?: number
              p_agreement_id?: string
              p_amount_outstanding?: number
              p_amount_paid?: number
              p_due_date: string
              p_notes?: string
              p_org_id: string
              p_payment_reference?: string
              p_period_end: string
              p_period_start: string
              p_rent_amount: number
              p_status?: string
              p_tenancy_id: string
            }
            Returns: string
          }
      log_document_download: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      log_document_view: { Args: { p_document_id: string }; Returns: undefined }
      migrate_companies_to_entities: {
        Args: { p_org_id: string }
        Returns: Json
      }
      migrate_compliance_to_v2: { Args: { p_org_id: string }; Returns: Json }
      migrate_contractors_to_v2: { Args: { p_org_id: string }; Returns: Json }
      migrate_income_costs_to_snapshots: {
        Args: { p_org_id: string }
        Returns: Json
      }
      migrate_loans_to_v2: { Args: { p_org_id: string }; Returns: Json }
      migrate_properties_to_v2: { Args: { p_org_id: string }; Returns: Json }
      migrate_rooms_to_v2: { Args: { p_org_id: string }; Returns: Json }
      migrate_tenancies_to_agreements: {
        Args: { p_org_id: string }
        Returns: Json
      }
      migrate_tenants_to_v2: { Args: { p_org_id: string }; Returns: Json }
      refresh_compliance_statuses_v2: { Args: never; Returns: undefined }
      restore_document: { Args: { p_document_id: string }; Returns: boolean }
      run_compliance_scan: { Args: { p_org_id: string }; Returns: Json }
      run_v1_to_v2_migration: { Args: { p_org_id: string }; Returns: Json }
      schedule_compliance_reminders: {
        Args: {
          p_compliance_item_id: string
          p_expiry_date: string
          p_org_id: string
        }
        Returns: undefined
      }
      seed_compliance_requirements_v2: {
        Args: { target_property_id: string }
        Returns: undefined
      }
      soft_delete_document: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      update_job_priorities: { Args: never; Returns: number }
      update_rent_schedule_item_status: {
        Args: {
          p_amount_outstanding?: number
          p_amount_paid?: number
          p_id: string
          p_notes?: string
          p_status: string
        }
        Returns: undefined
      }
      update_rent_schedule_statuses: { Args: never; Returns: undefined }
      user_can_access_investor_report: {
        Args: { file_name: string }
        Returns: boolean
      }
      user_has_org_access: { Args: { check_org_id: string }; Returns: boolean }
      user_has_shareholder_access: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { check_tenancy_id: string }
        Returns: boolean
      }
      user_has_tenant_access_by_tenant_id: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
      user_is_tenant_portal_user: { Args: never; Returns: boolean }
      user_owns_maintenance_folder: {
        Args: { folder_name: string }
        Returns: boolean
      }
      user_owns_property_folder: {
        Args: { folder_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "viewer"
      autofill_source_type:
        | "postcode_lookup"
        | "epc"
        | "floorplan"
        | "listing"
        | "inventory"
        | "photo"
        | "default"
      autofill_suggestion_status: "pending" | "accepted" | "rejected"
      passport_change_reason: "ai_accept" | "manual_edit"
      payment_method:
        | "bank_transfer"
        | "standing_order"
        | "direct_debit"
        | "cash"
        | "cheque"
      rent_status:
        | "upcoming"
        | "due"
        | "paid"
        | "partial"
        | "overdue"
        | "bad_debt"
      room_status: "vacant" | "occupied" | "notice" | "maintenance"
      room_type: "single" | "double" | "ensuite" | "studio"
      tenancy_status: "pending" | "active" | "notice" | "ended"
      tenant_status: "prospect" | "active" | "past" | "blacklisted"
      update_creator_type: "manager" | "tenant" | "contractor" | "system"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "viewer"],
      autofill_source_type: [
        "postcode_lookup",
        "epc",
        "floorplan",
        "listing",
        "inventory",
        "photo",
        "default",
      ],
      autofill_suggestion_status: ["pending", "accepted", "rejected"],
      passport_change_reason: ["ai_accept", "manual_edit"],
      payment_method: [
        "bank_transfer",
        "standing_order",
        "direct_debit",
        "cash",
        "cheque",
      ],
      rent_status: [
        "upcoming",
        "due",
        "paid",
        "partial",
        "overdue",
        "bad_debt",
      ],
      room_status: ["vacant", "occupied", "notice", "maintenance"],
      room_type: ["single", "double", "ensuite", "studio"],
      tenancy_status: ["pending", "active", "notice", "ended"],
      tenant_status: ["prospect", "active", "past", "blacklisted"],
      update_creator_type: ["manager", "tenant", "contractor", "system"],
    },
  },
} as const
