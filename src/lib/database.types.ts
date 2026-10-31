
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "anchors": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"label": string,"lat": number,"lng": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"label": string,"lat": number,"lng": number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"label"?: string,"lat"?: number,"lng"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "anchors_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "active": boolean,"created_at": string,"event_id": string,"expires_at": string | null,"id": string,"level": string,"message": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"event_id": string,"expires_at"?: string | null,"id"?: string,"level"?: string,"message": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"event_id"?: string,"expires_at"?: string | null,"id"?: string,"level"?: string,"message"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"description": string | null,"ends_at": string | null,"id": string,"is_published": boolean,"max_lat": number,"max_lng": number,"min_lat": number,"min_lng": number,"name": string,"owner_id": string,"slug": string,"starts_at": string | null,"updated_at": string,"zone": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"is_published"?: boolean,"max_lat": number,"max_lng": number,"min_lat": number,"min_lng": number,"name": string,"owner_id"?: string,"slug": string,"starts_at"?: string | null,"updated_at"?: string,"zone"?: never
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"is_published"?: boolean,"max_lat"?: number,"max_lng"?: number,"min_lat"?: number,"min_lng"?: number,"name"?: string,"owner_id"?: string,"slug"?: string,"starts_at"?: string | null,"updated_at"?: string,"zone"?: never
                  }
                  Relationships: [
                    
                  ]
                },"layers": {
                  Row: {
                    "corners": Json | null,"created_at": string,"event_id": string,"features": Json | null,"id": string,"image_path": string | null,"kind": string,"name": string,"opacity": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corners"?: Json | null,"created_at"?: string,"event_id": string,"features"?: Json | null,"id"?: string,"image_path"?: string | null,"kind": string,"name"?: string,"opacity"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "corners"?: Json | null,"created_at"?: string,"event_id"?: string,"features"?: Json | null,"id"?: string,"image_path"?: string | null,"kind"?: string,"name"?: string,"opacity"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "layers_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"pois": {
                  Row: {
                    "category": string,"code": string | null,"created_at": string,"description": string | null,"event_id": string,"geom": unknown,"id": string,"lat": number,"lng": number,"metadata": NonNullable<Json>,"name": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"code"?: string | null,"created_at"?: string,"description"?: string | null,"event_id": string,"geom"?: never,"id"?: string,"lat": number,"lng": number,"metadata"?: NonNullable<Json>,"name": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"code"?: string | null,"created_at"?: string,"description"?: string | null,"event_id"?: string,"geom"?: never,"id"?: string,"lat"?: number,"lng"?: number,"metadata"?: NonNullable<Json>,"name"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pois_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_event_owner":
{ Args: { "eid": string }; Returns: boolean
                           },
"is_event_visible":
{ Args: { "eid": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
