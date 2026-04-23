#!/usr/bin/env python3
"""
Script para limpiar las rutas publicadas de la base de datos.
- Elimina todos los registros de asistentes
- Elimina todos los registros de rutas_publicadas
- Mantiene intacta la tabla de rutas base
"""

import sqlite3
import sys
from pathlib import Path

def clean_published_routes(db_path="rutas_moto.db", confirm=True):
    """Elimina todas las rutas publicadas y sus asistentes."""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"📂 Conectando a la base de datos: {db_path}")
        
        # Obtener información actual
        cursor.execute("SELECT COUNT(*) FROM rutas_publicadas")
        rutas_publicadas_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM asistentes")
        asistentes_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM rutas")
        rutas_base_count = cursor.fetchone()[0]
        
        print("\n📊 Estado actual:")
        print(f"   • Rutas base: {rutas_base_count}")
        print(f"   • Rutas publicadas: {rutas_publicadas_count}")
        print(f"   • Asistentes registrados: {asistentes_count}")
        
        if rutas_publicadas_count == 0 and asistentes_count == 0:
            print("\n✅ La base de datos ya está limpia (sin rutas publicadas).")
            conn.close()
            return True
        
        if confirm:
            print("\n⚠️  Se van a eliminar:")
            print(f"   • {asistentes_count} registros de asistentes")
            print(f"   • {rutas_publicadas_count} rutas publicadas")
            print("\n❓ ¿Deseas continuar? (escribe 'sí' para confirmar)")
            response = input("> ").strip().lower()
            
            if response not in ['sí', 'si', 'yes', 'y']:
                print("❌ Operación cancelada.")
                conn.close()
                return False
        
        print("\n🗑️  Eliminando datos...")
        
        # Eliminar asistentes primero (por restricción de clave foránea)
        cursor.execute("DELETE FROM asistentes")
        asistentes_eliminados = cursor.rowcount
        print(f"   ✓ {asistentes_eliminados} registros de asistentes eliminados")
        
        # Eliminar rutas publicadas
        cursor.execute("DELETE FROM rutas_publicadas")
        rutas_eliminadas = cursor.rowcount
        print(f"   ✓ {rutas_eliminadas} rutas publicadas eliminadas")
        
        # Confirmar cambios
        conn.commit()
        
        print("\n✅ Base de datos limpiada exitosamente!")
        print(f"\n📊 Estado final:")
        print(f"   • Rutas base: {rutas_base_count} (sin cambios)")
        print(f"   • Rutas publicadas: 0")
        print(f"   • Asistentes: 0")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"\n❌ Error en la base de datos: {e}")
        return False
    except KeyboardInterrupt:
        print("\n\n❌ Operación cancelada por el usuario.")
        return False
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        return False

if __name__ == "__main__":
    # Buscar la base de datos
    db_paths = [
        "rutas_moto.db",
        "../rutas_moto.db",
        "../../rutas_moto.db",
    ]
    
    db_found = None
    for path in db_paths:
        if Path(path).exists():
            db_found = path
            break
    
    if db_found:
        # Permitir modo automático con flag --yes
        confirm = "--yes" not in sys.argv
        success = clean_published_routes(db_found, confirm=confirm)
        sys.exit(0 if success else 1)
    else:
        print("⚠️  No se encontró la base de datos 'rutas_moto.db'")
        print("   Rutas buscadas:")
        for path in db_paths:
            print(f"   - {path}")
        sys.exit(1)
