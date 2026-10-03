-- ============================================================
-- 20261002_015_superadmin_rol.sql
--
-- Añade el tercer rol del sistema: 'superadmin'.
-- Roles resultantes: superadmin, admin, vendedor.
--
-- IMPORTANTE: este archivo SÓLO contiene el ALTER TYPE, a propósito.
-- PostgreSQL no permite usar un valor de enum recién añadido dentro de
-- la misma transacción que lo crea ("unsafe use of new value of enum
-- type"). Al terminar este archivo el valor queda comprometido y las
-- migraciones siguientes (016, 017) ya pueden referenciarlo.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================

alter type public.user_role add value if not exists 'superadmin';
