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
      compliance_items: {
        Row: {
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
      contractors: {
        Row: {
          company_name: string | null
          compliance_types: string[]
          created_at: string
          email: string | null
          id: string
          is_preferred: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          service_areas: string[] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name?: string | null
          compliance_types?: string[]
          created_at?: string
          email?: string | null
          id?: string
          is_preferred?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          service_areas?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string | null
          compliance_types?: string[]
          created_at?: string
          email?: string | null
          id?: string
          is_preferred?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          service_areas?: string[] | null
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
          asset_category: string | null
          bathrooms: number | null
          beds: number | null
          beneficial_override_notes: string | null
          beneficial_override_percent: number | null
          co_alarm_required: boolean | null
          conservation_area: boolean
          construction_type: string | null
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
          ownership_entity: string | null
          ownership_percent: number | null
          place_id: string | null
          planning_authority: string | null
          postcode: string | null
          postcode_area: string | null
          property_name: string | null
          property_type: string | null
          purchase_price_gbp: number | null
          selective_licence_required: boolean | null
          tenure: string | null
          title_number: string | null
          town_city: string | null
          updated_at: string
          uprn: string | null
          valuation_confidence: string | null
          value_change_percent: number | null
          year_built: string | null
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
          co_alarm_required?: boolean | null
          conservation_area?: boolean
          construction_type?: string | null
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
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          planning_authority?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_name?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          selective_licence_required?: boolean | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
          valuation_confidence?: string | null
          value_change_percent?: number | null
          year_built?: string | null
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
          co_alarm_required?: boolean | null
          conservation_area?: boolean
          construction_type?: string | null
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
          ownership_entity?: string | null
          ownership_percent?: number | null
          place_id?: string | null
          planning_authority?: string | null
          postcode?: string | null
          postcode_area?: string | null
          property_name?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          selective_licence_required?: boolean | null
          tenure?: string | null
          title_number?: string | null
          town_city?: string | null
          updated_at?: string
          uprn?: string | null
          valuation_confidence?: string | null
          value_change_percent?: number | null
          year_built?: string | null
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
      scheduled_email_runs: {
        Row: {
          created_at: string
          email_subject: string | null
          error: string | null
          id: string
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
          provider_message_id?: string | null
          recipient_email?: string | null
          run_key?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
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
    }
    Functions: {
      get_user_org_id: { Args: never; Returns: string }
      schedule_compliance_reminders: {
        Args: {
          p_compliance_item_id: string
          p_expiry_date: string
          p_org_id: string
        }
        Returns: undefined
      }
      user_has_org_access: { Args: { check_org_id: string }; Returns: boolean }
      user_has_shareholder_access: {
        Args: { check_org_id: string }
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
    },
  },
} as const
