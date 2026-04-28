from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, func
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
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    asistentes = relationship("Asistente", back_populates="user")

class Ruta(Base):
    __tablename__ = "rutas"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    link_ruta = Column(Text, nullable=False)
    link_encuentro = Column(Text, nullable=False)
    link_restaurante = Column(Text, nullable=True)
    fecha = Column(String(50), default="Por definir")
    hora = Column(String(50), default="Por confirmar")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    publicaciones = relationship("RutaPublicada", back_populates="ruta")

class RutaPublicada(Base):
    __tablename__ = "rutas_publicadas"
    
    id = Column(Integer, primary_key=True, index=True)
    ruta_id = Column(Integer, ForeignKey("rutas.id"), nullable=False)
    organizador_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dia_ruta = Column(String(50), nullable=False)
    hora_ruta = Column(String(50), nullable=False)
    link_encuentro_personalizado = Column(Text, nullable=True)
    link_restaurante_personalizado = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ruta = relationship("Ruta", back_populates="publicaciones")
    organizador = relationship("User")
    asistentes = relationship("Asistente", back_populates="ruta_publicada")

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
