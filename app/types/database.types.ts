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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          accion: string
          created_at: string | null
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          registro_id: string
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id: string
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id?: string
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      citas_capacitacion: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          estado: string
          fecha_hora: string
          id: string
          notas: string | null
          notificada_vencida: boolean
          owner_id: string | null
          producto_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_hora: string
          id?: string
          notas?: string | null
          notificada_vencida?: boolean
          owner_id?: string | null
          producto_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_hora?: string
          id?: string
          notas?: string | null
          notificada_vencida?: boolean
          owner_id?: string | null
          producto_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_capacitacion_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_capacitacion_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_capacitacion_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "citas_capacitacion_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_capacitacion_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "citas_capacitacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      citas_descartadas: {
        Row: {
          cita_id: string
          created_at: string
          umbral_minutos: number
          user_id: string
        }
        Insert: {
          cita_id: string
          created_at?: string
          umbral_minutos?: number
          user_id: string
        }
        Update: {
          cita_id?: string
          created_at?: string
          umbral_minutos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_descartadas_cita_id_fkey"
            columns: ["cita_id"]
            isOneToOne: false
            referencedRelation: "citas_capacitacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_descartadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_descartadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      cliente_interacciones: {
        Row: {
          canal: string
          cliente_id: string
          created_at: string
          created_by: string | null
          id: string
          nota: string
        }
        Insert: {
          canal: string
          cliente_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nota: string
        }
        Update: {
          canal?: string
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nota?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      clientes: {
        Row: {
          ciudad: string | null
          comuna: string | null
          created_at: string | null
          created_by: string | null
          direccion: string | null
          email: string | null
          id: string
          imagen_url: string | null
          kame_id: string | null
          nombre_contacto: string | null
          owner_id: string | null
          razon_social: string
          rut: string | null
          telefono: string | null
          updated_at: string | null
          version: number
        }
        Insert: {
          ciudad?: string | null
          comuna?: string | null
          created_at?: string | null
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          imagen_url?: string | null
          kame_id?: string | null
          nombre_contacto?: string | null
          owner_id?: string | null
          razon_social: string
          rut?: string | null
          telefono?: string | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          ciudad?: string | null
          comuna?: string | null
          created_at?: string | null
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          imagen_url?: string | null
          kame_id?: string | null
          nombre_contacto?: string | null
          owner_id?: string | null
          razon_social?: string
          rut?: string | null
          telefono?: string | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clientes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "clientes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      configuracion_alertas: {
        Row: {
          clave: string
          valor: number
        }
        Insert: {
          clave: string
          valor: number
        }
        Update: {
          clave?: string
          valor?: number
        }
        Relationships: []
      }
      configuracion_archivado: {
        Row: {
          dias: number
          modulo: string
        }
        Insert: {
          dias: number
          modulo: string
        }
        Update: {
          dias?: number
          modulo?: string
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          component: string
          created_at: string | null
          descripcion: string | null
          id: string
          key: string
          label: string
          resource: string
          tipo: string
        }
        Insert: {
          component: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          key: string
          label: string
          resource: string
          tipo: string
        }
        Update: {
          component?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          key?: string
          label?: string
          resource?: string
          tipo?: string
        }
        Relationships: []
      }
      entidad_imagenes: {
        Row: {
          created_at: string
          created_by: string | null
          entidad_id: string
          entidad_tipo: string
          id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entidad_id: string
          entidad_tipo: string
          id?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "entidad_imagenes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entidad_imagenes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      error_log: {
        Row: {
          contexto: Json | null
          created_at: string | null
          id: string
          mensaje: string
          ruta: string | null
          user_id: string | null
        }
        Insert: {
          contexto?: Json | null
          created_at?: string | null
          id?: string
          mensaje: string
          ruta?: string | null
          user_id?: string | null
        }
        Update: {
          contexto?: Json | null
          created_at?: string | null
          id?: string
          mensaje?: string
          ruta?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      features: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      historial_estados: {
        Row: {
          created_at: string
          created_by: string | null
          entidad_id: string
          entidad_tipo: string
          estado_anterior: string | null
          estado_nuevo: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entidad_id: string
          entidad_tipo: string
          estado_anterior?: string | null
          estado_nuevo: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entidad_id?: string
          entidad_tipo?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_estados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      kame_tokens: {
        Row: {
          expires_at: string
          id: number
          token: string
          updated_at: string | null
        }
        Insert: {
          expires_at: string
          id?: number
          token: string
          updated_at?: string | null
        }
        Update: {
          expires_at?: string
          id?: number
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_interacciones: {
        Row: {
          canal: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          nota: string
        }
        Insert: {
          canal: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          nota: string
        }
        Update: {
          canal?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          nota?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interacciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interacciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "lead_interacciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archivado: boolean
          cliente_id: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          estado: string | null
          fecha_cierre: string | null
          id: string
          nombre: string
          notificado_inactividad: boolean
          origen: string | null
          owner_id: string | null
          telefono: string | null
          updated_at: string | null
          version: number
        }
        Insert: {
          archivado?: boolean
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          nombre: string
          notificado_inactividad?: boolean
          origen?: string | null
          owner_id?: string | null
          telefono?: string | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          archivado?: boolean
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          nombre?: string
          notificado_inactividad?: boolean
          origen?: string | null
          owner_id?: string | null
          telefono?: string | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          entidad_id: string
          entidad_tipo: string
          id: string
          leida: boolean
          mensaje: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entidad_id: string
          entidad_tipo: string
          id?: string
          leida?: boolean
          mensaje?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          leida?: boolean
          mensaje?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          resource: string
        }
        Insert: {
          action: string
          id?: string
          resource: string
        }
        Update: {
          action?: string
          id?: string
          resource?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          categoria: string | null
          created_at: string | null
          created_by: string | null
          estado: string | null
          id: string
          nombre: string
          sku: string
          unidad_medida: string | null
          updated_at: string | null
          version: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          id?: string
          nombre: string
          sku: string
          unidad_medida?: string | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          id?: string
          nombre?: string
          sku?: string
          unidad_medida?: string | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "productos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          created_at: string
          profile_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          settings: Json
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          settings?: Json
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          settings?: Json
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      superadmins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "superadmins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "superadmins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      tareas: {
        Row: {
          completada: boolean
          created_at: string
          created_by: string | null
          entidad_id: string
          entidad_tipo: string
          fecha_vencimiento: string | null
          id: string
          notificada_vencida: boolean
          owner_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          completada?: boolean
          created_at?: string
          created_by?: string | null
          entidad_id: string
          entidad_tipo: string
          fecha_vencimiento?: string | null
          id?: string
          notificada_vencida?: boolean
          owner_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          completada?: boolean
          created_at?: string
          created_by?: string | null
          entidad_id?: string
          entidad_tipo?: string
          fecha_vencimiento?: string | null
          id?: string
          notificada_vencida?: boolean
          owner_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "tareas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      tareas_descartadas: {
        Row: {
          created_at: string
          tarea_id: string
          umbral_minutos: number
          user_id: string
        }
        Insert: {
          created_at?: string
          tarea_id: string
          umbral_minutos?: number
          user_id: string
        }
        Update: {
          created_at?: string
          tarea_id?: string
          umbral_minutos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_descartadas_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tareas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_descartadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_descartadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      tecnicos: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ticket_productos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          producto_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          producto_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          producto_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_productos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_productos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ticket_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_productos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          archivado: boolean
          cliente_id: string
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          id: string
          owner_id: string | null
          prioridad: string | null
          tecnico_id: string | null
          titulo: string
          updated_at: string | null
          version: number
        }
        Insert: {
          archivado?: boolean
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          owner_id?: string | null
          prioridad?: string | null
          tecnico_id?: string | null
          titulo: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          archivado?: boolean
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          owner_id?: string | null
          prioridad?: string | null
          tecnico_id?: string | null
          titulo?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "tickets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "tickets_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_post_venta: {
        Row: {
          archivado: boolean
          cliente_celular_libre: string | null
          cliente_ciudad_libre: string | null
          cliente_id: string | null
          cliente_nombre_libre: string | null
          cliente_rut_libre: string | null
          created_at: string
          created_by: string | null
          descripcion_falla: string | null
          estado: string
          fecha_cierre: string | null
          fecha_despacho: string | null
          fecha_ingreso: string
          fecha_tope: string | null
          id: string
          n_guia: string
          notificada_vencida: boolean
          observaciones: string | null
          producto_id: string
          updated_at: string
        }
        Insert: {
          archivado?: boolean
          cliente_celular_libre?: string | null
          cliente_ciudad_libre?: string | null
          cliente_id?: string | null
          cliente_nombre_libre?: string | null
          cliente_rut_libre?: string | null
          created_at?: string
          created_by?: string | null
          descripcion_falla?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_despacho?: string | null
          fecha_ingreso?: string
          fecha_tope?: string | null
          id?: string
          n_guia: string
          notificada_vencida?: boolean
          observaciones?: string | null
          producto_id: string
          updated_at?: string
        }
        Update: {
          archivado?: boolean
          cliente_celular_libre?: string | null
          cliente_ciudad_libre?: string | null
          cliente_id?: string | null
          cliente_nombre_libre?: string | null
          cliente_rut_libre?: string | null
          created_at?: string
          created_by?: string | null
          descripcion_falla?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_despacho?: string | null
          fecha_ingreso?: string
          fecha_tope?: string | null
          id?: string
          n_guia?: string
          notificada_vencida?: boolean
          observaciones?: string | null
          producto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_post_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_post_venta_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_post_venta_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "tickets_post_venta_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_post_venta_seguimientos: {
        Row: {
          comentario: string
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          ticket_id: string
        }
        Insert: {
          comentario: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          ticket_id: string
        }
        Update: {
          comentario?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_post_venta_seguimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_post_venta_seguimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "tickets_post_venta_seguimientos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_post_venta"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          granted_by: string | null
          id: string
          orden: number | null
          user_id: string | null
          visible: boolean
          widget_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          orden?: number | null
          user_id?: string | null
          visible?: boolean
          widget_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          orden?: number | null
          user_id?: string | null
          visible?: boolean
          widget_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_widgets_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dashboard_widgets_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_dashboard_widgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dashboard_widgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_dashboard_widgets_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "dashboard_widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_features: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          feature_id: string | null
          granted_by: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          feature_id?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          feature_id?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_features_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_features_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_features_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_features_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          created_at: string | null
          created_by: string | null
          effect: string
          id: string
          permission_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effect: string
          id?: string
          permission_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effect?: string
          id?: string
          permission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          owner_id: string | null
          producto_id: string
          updated_at: string
          valor: number
          version: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          owner_id?: string | null
          producto_id: string
          updated_at?: string
          valor: number
          version?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          owner_id?: string | null
          producto_id?: string
          updated_at?: string
          valor?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ventas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vista_performance_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vista_funnel_leads: {
        Row: {
          estado: string | null
          total: number | null
        }
        Relationships: []
      }
      vista_performance_vendedores: {
        Row: {
          full_name: string | null
          leads_ganados: number | null
          leads_perdidos: number | null
          leads_total: number | null
          vendedor_id: string | null
        }
        Insert: {
          full_name?: string | null
          leads_ganados?: never
          leads_perdidos?: never
          leads_total?: never
          vendedor_id?: string | null
        }
        Update: {
          full_name?: string | null
          leads_ganados?: never
          leads_perdidos?: never
          leads_total?: never
          vendedor_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      convertir_lead_a_cliente: {
        Args: { p_lead_id: string; p_razon_social: string; p_rut: string }
        Returns: string
      }
      fn_archivar_cerrados: { Args: never; Returns: undefined }
      fn_conteo_tickets_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          abiertos: number
          resueltos: number
          total: number
        }[]
      }
      fn_notificar_citas_vencidas: { Args: never; Returns: undefined }
      fn_notificar_leads_inactivos: { Args: never; Returns: undefined }
      fn_notificar_tareas_vencidas: { Args: never; Returns: undefined }
      fn_notificar_tickets_post_venta_vencidos: {
        Args: never
        Returns: undefined
      }
      has_permission: {
        Args: { p_action: string; p_resource: string; p_user: string }
        Returns: boolean
      }
      mis_features: {
        Args: never
        Returns: {
          key: string
        }[]
      }
      mis_widgets: {
        Args: never
        Returns: {
          component: string
          config: Json
          key: string
          label: string
          orden: number
          resource: string
          tipo: string
          visible: boolean
          widget_id: string
        }[]
      }
      mover_lead_estado: {
        Args: { p_lead_id: string; p_nuevo_estado: string }
        Returns: undefined
      }
      mover_ticket_estado: {
        Args: { p_nuevo_estado: string; p_ticket_id: string }
        Returns: undefined
      }
      permisos_efectivos_usuario: {
        Args: { p_user: string }
        Returns: {
          action: string
          resource: string
        }[]
      }
      usuarios_por_rol: {
        Args: { p_rol: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
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
    Enums: {},
  },
} as const
