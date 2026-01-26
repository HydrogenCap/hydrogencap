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
      documents: {
        Row: {
          ai_doc_type_confidence: number | null
          ai_property_confidence: number | null
          ai_suggested_doc_type: string | null
          ai_suggested_property_id: string | null
          created_at: string
          doc_type: string | null
          expiry_date: string | null
          extracted_address_text: string | null
          extracted_epc_rating: string | null
          extracted_issue_date: string | null
          extracted_reference_number: string | null
          extraction_status: string | null
          file_url: string
          final_file_name: string | null
          id: string
          org_id: string
          original_file_name: string
          property_id: string | null
          renamed_at: string | null
          review_status: string | null
          updated_at: string
        }
        Insert: {
          ai_doc_type_confidence?: number | null
          ai_property_confidence?: number | null
          ai_suggested_doc_type?: string | null
          ai_suggested_property_id?: string | null
          created_at?: string
          doc_type?: string | null
          expiry_date?: string | null
          extracted_address_text?: string | null
          extracted_epc_rating?: string | null
          extracted_issue_date?: string | null
          extracted_reference_number?: string | null
          extraction_status?: string | null
          file_url: string
          final_file_name?: string | null
          id?: string
          org_id: string
          original_file_name: string
          property_id?: string | null
          renamed_at?: string | null
          review_status?: string | null
          updated_at?: string
        }
        Update: {
          ai_doc_type_confidence?: number | null
          ai_property_confidence?: number | null
          ai_suggested_doc_type?: string | null
          ai_suggested_property_id?: string | null
          created_at?: string
          doc_type?: string | null
          expiry_date?: string | null
          extracted_address_text?: string | null
          extracted_epc_rating?: string | null
          extracted_issue_date?: string | null
          extracted_reference_number?: string | null
          extraction_status?: string | null
          file_url?: string
          final_file_name?: string | null
          id?: string
          org_id?: string
          original_file_name?: string
          property_id?: string | null
          renamed_at?: string | null
          review_status?: string | null
          updated_at?: string
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
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          cover_type: string | null
          created_at: string
          excess_gbp: number | null
          id: string
          insurer_name: string | null
          notes: string | null
          policy_number: string | null
          premium_gbp: number | null
          property_id: string
          renewal_date: string | null
          updated_at: string
        }
        Insert: {
          cover_type?: string | null
          created_at?: string
          excess_gbp?: number | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          policy_number?: string | null
          premium_gbp?: number | null
          property_id: string
          renewal_date?: string | null
          updated_at?: string
        }
        Update: {
          cover_type?: string | null
          created_at?: string
          excess_gbp?: number | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          policy_number?: string | null
          premium_gbp?: number | null
          property_id?: string
          renewal_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
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
          bathrooms: number | null
          beds: number | null
          beneficial_override_notes: string | null
          beneficial_override_percent: number | null
          country: string | null
          county: string | null
          created_at: string
          current_value_gbp: number | null
          epc_rating: string | null
          epc_required: boolean | null
          formatted_address: string | null
          geocode_confidence: string | null
          geocode_error: string | null
          geocode_source: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string
          land_registry_link: string | null
          latitude: number | null
          lease_years_remaining: number | null
          legal_owner_company_id: string | null
          legal_owner_party_id: string | null
          listed_status: string | null
          longitude: number | null
          notes: string | null
          org_id: string
          original_purchase_date: string | null
          ownership_entity: string | null
          ownership_percent: number | null
          place_id: string | null
          postcode: string | null
          postcode_area: string | null
          property_type: string | null
          purchase_price_gbp: number | null
          tenure: string | null
          title_number: string | null
          town_city: string | null
          updated_at: string
          uprn: string | null
        }
        Insert: {
          address_line: string
          address_line2?: string | null
          area_name?: string | null
          bathrooms?: number | null
          beds?: number | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          country?: string | null
          county?: string | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          land_registry_link?: string | null
          latitude?: number | null
          lease_years_remaining?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          listed_status?: string | null
          longitude?: number | null
          notes?: string | null
          org_id: string
          original_purchase_date?: string | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
        }
        Update: {
          address_line?: string
          address_line2?: string | null
          area_name?: string | null
          bathrooms?: number | null
          beds?: number | null
          beneficial_override_notes?: string | null
          beneficial_override_percent?: number | null
          country?: string | null
          county?: string | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          formatted_address?: string | null
          geocode_confidence?: string | null
          geocode_error?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          land_registry_link?: string | null
          latitude?: number | null
          lease_years_remaining?: number | null
          legal_owner_company_id?: string | null
          legal_owner_party_id?: string | null
          listed_status?: string | null
          longitude?: number | null
          notes?: string | null
          org_id?: string
          original_purchase_date?: string | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
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
          bathrooms: number | null
          bedrooms: number | null
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
          land_registry_title_number: string | null
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
          owner_tenure: string | null
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
          bathrooms?: number | null
          bedrooms?: number | null
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
          land_registry_title_number?: string | null
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
          owner_tenure?: string | null
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
          bathrooms?: number | null
          bedrooms?: number | null
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
          land_registry_title_number?: string | null
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
          owner_tenure?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: never; Returns: string }
      user_has_org_access: { Args: { check_org_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "viewer"
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
    },
  },
} as const
