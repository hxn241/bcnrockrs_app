from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    moto_marca = Column(String(100), nullable=True)
    moto_modelo = Column(String(120), nullable=True)
    moto_anio = Column(Integer, nullable=True)
    avatar_filename = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    moto_foto_1_filename = Column(String(255), nullable=True)
    moto_foto_2_filename = Column(String(255), nullable=True)
    moto_foto_3_filename = Column(String(255), nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def avatar_url(self) -> str | None:
        if not self.avatar_filename:
            return None
        return f"/uploads/user_avatars/{self.id}/{self.avatar_filename}"

    def _moto_foto_public_url(self, fn: str | None) -> str | None:
        if not fn:
            return None
        return f"/uploads/user_moto_fotos/{self.id}/{fn}"

    @property
    def moto_foto_1_url(self) -> str | None:
        return self._moto_foto_public_url(self.moto_foto_1_filename)

    @property
    def moto_foto_2_url(self) -> str | None:
        return self._moto_foto_public_url(self.moto_foto_2_filename)

    @property
    def moto_foto_3_url(self) -> str | None:
        return self._moto_foto_public_url(self.moto_foto_3_filename)

    asistentes = relationship("Asistente", back_populates="user")
    grupos_creados = relationship("Grupo", back_populates="creador")
    grupos_membresias = relationship("GrupoMiembro", back_populates="user")
    grupos_solicitudes = relationship("GrupoSolicitud", back_populates="user")


class Grupo(Base):
    __tablename__ = "grupos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False, index=True)
    creador_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    logo_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creador = relationship("User", back_populates="grupos_creados")
    miembros = relationship("GrupoMiembro", back_populates="grupo", cascade="all, delete-orphan")
    solicitudes = relationship("GrupoSolicitud", back_populates="grupo", cascade="all, delete-orphan")
    salidas = relationship("RutaPublicada", back_populates="grupo")


class GrupoMiembro(Base):
    __tablename__ = "grupo_miembros"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    grupo = relationship("Grupo", back_populates="miembros")
    user = relationship("User", back_populates="grupos_membresias")


class GrupoSolicitud(Base):
    __tablename__ = "grupo_solicitudes"
    __table_args__ = (UniqueConstraint("grupo_id", "user_id", name="uq_grupo_solicitud_user"),)

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    grupo = relationship("Grupo", back_populates="solicitudes")
    user = relationship("User", back_populates="grupos_solicitudes")


class Ruta(Base):
    __tablename__ = "rutas"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    link_ruta = Column(Text, nullable=False)
    link_encuentro = Column(Text, nullable=False)
    link_restaurante = Column(Text, nullable=True)
    embed_recorrido_url = Column(Text, nullable=True)
    fecha = Column(String(50), default="Por definir")
    hora = Column(String(50), default="Por confirmar")
    created_at = Column(DateTime, default=datetime.utcnow)
    creador_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Zona de la plantilla (filtros al publicar): código CCAA y código INE provincia (01–52).
    ubicacion_region = Column(String(16), nullable=True, index=True)
    ubicacion_ciudad = Column(String(8), nullable=True, index=True)
    # El creador puede marcarla; solo un admin borra del catálogo.
    marcada_eliminacion = Column(Boolean, nullable=False, default=False)

    publicaciones = relationship("RutaPublicada", back_populates="ruta")
    creador = relationship("User", foreign_keys=[creador_id])


class RutaPublicada(Base):
    __tablename__ = "rutas_publicadas"
    
    id = Column(Integer, primary_key=True, index=True)
    ruta_id = Column(Integer, ForeignKey("rutas.id"), nullable=False)
    organizador_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dia_ruta = Column(String(50), nullable=False)
    hora_ruta = Column(String(50), nullable=False)
    link_encuentro_personalizado = Column(Text, nullable=True)
    link_restaurante_personalizado = Column(Text, nullable=True)
    # Zona de la salida (internacional / filtros “Madrid”, etc.)
    ubicacion_pais = Column(String(2), nullable=False, default="ES")
    ubicacion_region = Column(String(120), nullable=True)
    ubicacion_ciudad = Column(String(120), nullable=True)
    # "abierta" = visible para todos en buscador/calendario; "grupo" = solo miembros del grupo.
    visibilidad = Column(String(20), nullable=False, default="abierta")
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ruta = relationship("Ruta", back_populates="publicaciones")
    organizador = relationship("User")
    grupo = relationship("Grupo", back_populates="salidas")
    asistentes = relationship("Asistente", back_populates="ruta_publicada")
    fotos = relationship(
        "RutaPublicadaFoto",
        back_populates="ruta_publicada",
        cascade="all, delete-orphan",
    )


class RutaPublicadaFoto(Base):
    __tablename__ = "ruta_publicada_fotos"

    id = Column(Integer, primary_key=True, index=True)
    ruta_publicada_id = Column(Integer, ForeignKey("rutas_publicadas.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ruta_publicada = relationship("RutaPublicada", back_populates="fotos")
    user = relationship("User")

class Asistente(Base):
    __tablename__ = "asistentes"
    
    id = Column(Integer, primary_key=True, index=True)
    ruta_publicada_id = Column(Integer, ForeignKey("rutas_publicadas.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ruta_publicada = relationship("RutaPublicada", back_populates="asistentes")
    user = relationship("User", back_populates="asistentes")

class RutaHistorico(Base):
    __tablename__ = "rutas_historico"
    
    id = Column(Integer, primary_key=True, index=True)
    ruta_id = Column(Integer, ForeignKey("rutas.id"), nullable=False)
    ruta_publicada_id = Column(Integer, nullable=False)  # Referencia a ID original (puede estar eliminado)
    organizador_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dia_ruta = Column(String(50), nullable=False, index=True)
    hora_ruta = Column(String(50), nullable=False)
    link_encuentro_personalizado = Column(Text, nullable=True)
    link_restaurante_personalizado = Column(Text, nullable=True)
    numero_asistentes = Column(Integer, default=0)
    fecha_archivado = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ruta = relationship("Ruta")
    organizador = relationship("User")
