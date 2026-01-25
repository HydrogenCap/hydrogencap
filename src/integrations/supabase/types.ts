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
      costs: {
        Row: {
          bills_gbp: number | null
          compliance_gbp: number | null
          created_at: string
          id: string
          insurance_gbp: number | null
          maintenance_gbp: number | null
          management_gbp: number | null
          other_gbp: number | null
          property_id: string
          updated_at: string
          year: number
        }
        Insert: {
          bills_gbp?: number | null
          compliance_gbp?: number | null
          created_at?: string
          id?: string
          insurance_gbp?: number | null
          maintenance_gbp?: number | null
          management_gbp?: number | null
          other_gbp?: number | null
          property_id: string
          updated_at?: string
          year: number
        }
        Update: {
          bills_gbp?: number | null
          compliance_gbp?: number | null
          created_at?: string
          id?: string
          insurance_gbp?: number | null
          maintenance_gbp?: number | null
          management_gbp?: number | null
          other_gbp?: number | null
          property_id?: string
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
          area_name: string | null
          bathrooms: number | null
          beds: number | null
          created_at: string
          current_value_gbp: number | null
          epc_rating: string | null
          epc_required: boolean | null
          id: string
          land_registry_link: string | null
          latitude: number | null
          lease_years_remaining: number | null
          listed_status: string | null
          longitude: number | null
          notes: string | null
          org_id: string
          original_purchase_date: string | null
          ownership_entity: string | null
          ownership_percent: number | null
          postcode: string | null
          postcode_area: string | null
          property_type: string | null
          purchase_price_gbp: number | null
          tenure: string | null
          title_number: string | null
          updated_at: string
          uprn: string | null
        }
        Insert: {
          address_line: string
          area_name?: string | null
          bathrooms?: number | null
          beds?: number | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          id?: string
          land_registry_link?: string | null
          latitude?: number | null
          lease_years_remaining?: number | null
          listed_status?: string | null
          longitude?: number | null
          notes?: string | null
          org_id: string
          original_purchase_date?: string | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          postcode?: string | null
          postcode_area?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          updated_at?: string
          uprn?: string | null
        }
        Update: {
          address_line?: string
          area_name?: string | null
          bathrooms?: number | null
          beds?: number | null
          created_at?: string
          current_value_gbp?: number | null
          epc_rating?: string | null
          epc_required?: boolean | null
          id?: string
          land_registry_link?: string | null
          latitude?: number | null
          lease_years_remaining?: number | null
          listed_status?: string | null
          longitude?: number | null
          notes?: string | null
          org_id?: string
          original_purchase_date?: string | null
          ownership_entity?: string | null
          ownership_percent?: number | null
          postcode?: string | null
          postcode_area?: string | null
          property_type?: string | null
          purchase_price_gbp?: number | null
          tenure?: string | null
          title_number?: string | null
          updated_at?: string
          uprn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
