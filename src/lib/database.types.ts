export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          added_at: string;
          added_by: string | null;
          added_by_name: string;
          expense_id: string | null;
          id: string;
          mime: string;
          name: string;
          org_id: string;
          sale_id: string | null;
          size: number;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          added_by?: string | null;
          added_by_name?: string;
          expense_id?: string | null;
          id?: string;
          mime?: string;
          name: string;
          org_id: string;
          sale_id?: string | null;
          size: number;
          storage_path: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          added_by_name?: string;
          expense_id?: string | null;
          id?: string;
          mime?: string;
          name?: string;
          org_id?: string;
          sale_id?: string | null;
          size?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attachments_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attachments_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attachments_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attachments_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_categories: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          org_id: string;
        };
        ComputedFields: never;
        Insert: {
          color: string;
          created_at?: string;
          id?: string;
          name: string;
          org_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_categories_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          date: string;
          id: string;
          note: string;
          org_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          date: string;
          id?: string;
          note?: string;
          org_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          date?: string;
          id?: string;
          note?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      invites: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          role: Database['public']['Enums']['app_role'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          role: Database['public']['Enums']['app_role'];
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: Database['public']['Enums']['app_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'invites_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invites_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      join_requests: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'join_requests_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'join_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lot_costs: {
        Row: {
          id: string;
          label: string;
          lot_id: string;
          org_id: string;
          position: number;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          label: string;
          lot_id: string;
          org_id: string;
          position?: number;
          value: number;
        };
        Update: {
          id?: string;
          label?: string;
          lot_id?: string;
          org_id?: string;
          position?: number;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'lot_costs_lot_id_fkey';
            columns: ['lot_id'];
            isOneToOne: false;
            referencedRelation: 'lots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_costs_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      lots: {
        Row: {
          arrival_date: string | null;
          code: string;
          created_at: string;
          id: string;
          lost: number;
          order_date: string;
          org_id: string;
          product_id: string;
          qty: number;
          status: Database['public']['Enums']['lot_status'];
          supplier: string;
        };
        ComputedFields: never;
        Insert: {
          arrival_date?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          lost?: number;
          order_date?: string;
          org_id: string;
          product_id: string;
          qty: number;
          status?: Database['public']['Enums']['lot_status'];
          supplier?: string;
        };
        Update: {
          arrival_date?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          lost?: number;
          order_date?: string;
          org_id?: string;
          product_id?: string;
          qty?: number;
          status?: Database['public']['Enums']['lot_status'];
          supplier?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lots_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lots_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          org_id: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      orgs: {
        Row: {
          color: string;
          created_at: string;
          created_by: string | null;
          currency: Database['public']['Enums']['currency_code'];
          default_margin: number;
          fx: number;
          id: string;
          join_code: string;
          min_stock: number;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database['public']['Enums']['currency_code'];
          default_margin?: number;
          fx?: number;
          id?: string;
          join_code?: string;
          min_stock?: number;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database['public']['Enums']['currency_code'];
          default_margin?: number;
          fx?: number;
          id?: string;
          join_code?: string;
          min_stock?: number;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orgs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      price_history: {
        Row: {
          effective_at: string;
          id: string;
          org_id: string;
          price: number;
          product_id: string;
          set_by: string | null;
          set_by_name: string;
        };
        ComputedFields: never;
        Insert: {
          effective_at?: string;
          id?: string;
          org_id: string;
          price: number;
          product_id: string;
          set_by?: string | null;
          set_by_name?: string;
        };
        Update: {
          effective_at?: string;
          id?: string;
          org_id?: string;
          price?: number;
          product_id?: string;
          set_by?: string | null;
          set_by_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'price_history_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_history_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_history_set_by_fkey';
            columns: ['set_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      product_types: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          org_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          org_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_types_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          created_at: string;
          icon: string;
          id: string;
          is_service: boolean;
          margin: number | null;
          min_stock: number;
          name: string;
          org_id: string;
          sku: string;
          type_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          icon?: string;
          id?: string;
          is_service?: boolean;
          margin?: number | null;
          min_stock?: number;
          name: string;
          org_id: string;
          sku: string;
          type_id?: string | null;
        };
        Update: {
          created_at?: string;
          icon?: string;
          id?: string;
          is_service?: boolean;
          margin?: number | null;
          min_stock?: number;
          name?: string;
          org_id?: string;
          sku?: string;
          type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_type_id_fkey';
            columns: ['type_id'];
            isOneToOne: false;
            referencedRelation: 'product_types';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          id: string;
          name?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          customer: string;
          date: string;
          id: string;
          lot_id: string | null;
          org_id: string;
          price: number;
          product_id: string;
          qty: number;
          sold_at: string;
          sold_by: string | null;
          sold_by_name: string;
        };
        ComputedFields: never;
        Insert: {
          customer?: string;
          date: string;
          id?: string;
          lot_id?: string | null;
          org_id: string;
          price: number;
          product_id: string;
          qty: number;
          sold_at?: string;
          sold_by?: string | null;
          sold_by_name?: string;
        };
        Update: {
          customer?: string;
          date?: string;
          id?: string;
          lot_id?: string | null;
          org_id?: string;
          price?: number;
          product_id?: string;
          qty?: number;
          sold_at?: string;
          sold_by?: string | null;
          sold_by_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_lot_id_fkey';
            columns: ['lot_id'];
            isOneToOne: false;
            referencedRelation: 'lots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'orgs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_sold_by_fkey';
            columns: ['sold_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_invite: string }; Returns: string };
      advance_lot: { Args: { p_lot: string }; Returns: Database['public']['Enums']['lot_status'] };
      approve_join_request: { Args: { p_request: string; p_role?: Database['public']['Enums']['app_role'] }; Returns: undefined };
      create_lot: {
        Args: {
          p_costs: Json;
          p_org: string;
          p_product: string;
          p_qty: number;
          p_status: Database['public']['Enums']['lot_status'];
          p_supplier: string;
        };
        Returns: string;
      };
      create_org: { Args: { p_color?: string; p_name: string }; Returns: string };
      create_product: {
        Args: {
          p_icon?: string;
          p_is_service?: boolean;
          p_margin: number;
          p_min_stock: number;
          p_name: string;
          p_org: string;
          p_price: number;
          p_sku: string;
          p_type: string;
        };
        Returns: string;
      };
      decline_invite: { Args: { p_invite: string }; Returns: undefined };
      invite_member: {
        Args: { p_email: string; p_org: string; p_role: Database['public']['Enums']['app_role'] };
        Returns: string;
      };
      my_invites: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          invited_by_name: string;
          org_name: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      my_join_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          org_name: string;
        }[];
      };
      record_sale: {
        Args: { p_customer: string; p_date: string; p_org: string; p_product: string; p_qty: number };
        Returns: string;
      };
      request_join: { Args: { p_code: string }; Returns: string };
      set_lot_qty: { Args: { p_lot: string; p_qty: number }; Returns: undefined };
      set_price: { Args: { p_price: number; p_product: string }; Returns: undefined };
      update_lot: {
        Args: {
          p_costs: Json;
          p_lot: string;
          p_product: string;
          p_qty: number;
          p_status: Database['public']['Enums']['lot_status'];
          p_supplier: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'Admin' | 'Vendas' | 'Stock' | 'Leitura';
      currency_code: 'MT' | 'USD' | 'ZAR';
      lot_status: 'encomendado' | 'transito' | 'recebido';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['Admin', 'Vendas', 'Stock', 'Leitura'],
      currency_code: ['MT', 'USD', 'ZAR'],
      lot_status: ['encomendado', 'transito', 'recebido'],
    },
  },
} as const;
