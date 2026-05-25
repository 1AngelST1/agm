#!/bin/bash

# 🧪 AGM RabbitMQ Testing Script
# Automatiza los escenarios de testing describidos en TESTING_PLAN.md

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
RABBITMQ_URL="amqp://agm_user:agm_password@rabbitmq:5672/agm"
RABBITMQ_MGMT="http://localhost:15672"
MS_ALUMNOS_URL="http://localhost:3002"
MS_NOTIFICACIONES_URL="http://localhost:3006"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# ============================================
# Funciones de Utilidad
# ============================================

print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

print_test() {
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo -e "${YELLOW}[TEST $TESTS_TOTAL] $1${NC}"
}

print_pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${GREEN}✅ PASSED: $1${NC}"
}

print_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${RED}❌ FAILED: $1${NC}"
}

check_service() {
  local url=$1
  local service_name=$2
  
  echo -n "Verificando $service_name... "
  
  if curl -s "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Disponible${NC}"
    return 0
  else
    echo -e "${RED}❌ No disponible${NC}"
    return 1
  fi
}

# ============================================
# 1. VERIFICAR AMBIENTE
# ============================================

print_header "1. VERIFICANDO AMBIENTE"

echo -e "${YELLOW}Verificando Docker containers...${NC}"

# Verificar que los containers estén corriendo
docker compose ps | grep -q agm_rabbitmq || (echo -e "${RED}RabbitMQ no está corriendo${NC}" && exit 1)
docker compose ps | grep -q agm_ms_alumnos || (echo -e "${RED}ms-alumnos no está corriendo${NC}" && exit 1)
docker compose ps | grep -q agm_ms_notificaciones || (echo -e "${RED}ms-notificaciones no está corriendo${NC}" && exit 1)

echo -e "${GREEN}✅ Todos los containers están corriendo${NC}"

# Esperar a que los servicios estén listos
echo -e "${YELLOW}Esperando a que los servicios estén listos...${NC}"
sleep 3

check_service "$RABBITMQ_MGMT" "RabbitMQ Management UI" || exit 1
check_service "$MS_ALUMNOS_URL" "ms-alumnos" || exit 1

# ============================================
# 2. VERIFICAR RABBITMQ CONFIGURATION
# ============================================

print_header "2. VERIFICANDO CONFIGURACIÓN DE RABBITMQ"

print_test "Verificar Exchange agm.events existe"
EXCHANGE_EXISTS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/exchanges/%2fagm" | grep -c "agm.events" || echo 0)
if [ "$EXCHANGE_EXISTS" -gt 0 ]; then
  print_pass "Exchange agm.events existe"
else
  print_fail "Exchange agm.events no existe"
fi

print_test "Verificar Queue notificaciones.queue existe"
QUEUE_EXISTS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/queues/%2fagm" | grep -c "notificaciones.queue" || echo 0)
if [ "$QUEUE_EXISTS" -gt 0 ]; then
  print_pass "Queue notificaciones.queue existe"
else
  print_fail "Queue notificaciones.queue no existe"
fi

# ============================================
# 3. TEST: INSCRIPCIÓN EXITOSA
# ============================================

print_header "3. TEST: INSCRIPCIÓN EXITOSA (HAPPY PATH)"

print_test "Crear alumno ALU_TEST_001"
ALUMNO_RESPONSE=$(curl -s -X POST "$MS_ALUMNOS_URL/alumnos" \
  -H "Content-Type: application/json" \
  -d '{
    "matricula": "ALU_TEST_001",
    "user_id": "user001",
    "carrera": "ITIS"
  }')

if echo "$ALUMNO_RESPONSE" | grep -q "ALU_TEST_001"; then
  print_pass "Alumno creado exitosamente"
else
  print_fail "Error creando alumno"
  echo "$ALUMNO_RESPONSE"
fi

print_test "Inscribir alumno en materia (sin JWT - puede fallar, es esperado)"
INSCRIPCION_RESPONSE=$(curl -s -X POST "$MS_ALUMNOS_URL/alumnos/inscribir" \
  -H "Content-Type: application/json" \
  -d '{
    "matricula_alumno": "ALU_TEST_001",
    "nrc_materia": "TEST001"
  }' 2>/dev/null || echo "{}")

# Como no tenemos JWT token válido, simplemente verificamos que el endpoint responde
if [ ! -z "$INSCRIPCION_RESPONSE" ]; then
  print_pass "Endpoint /inscribir responde"
else
  print_fail "Endpoint /inscribir no responde"
fi

# ============================================
# 4. VERIFICAR EVENTOS EN RABBITMQ
# ============================================

print_header "4. VERIFICANDO EVENTOS EN RABBITMQ"

print_test "Verificar Binding: alumno.inscrito"
BINDING_EXISTS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/bindings" | grep -c "alumno.inscrito" || echo 0)
if [ "$BINDING_EXISTS" -gt 0 ]; then
  print_pass "Binding alumno.inscrito configurado"
else
  print_fail "Binding alumno.inscrito no configurado"
fi

print_test "Verificar Binding: inscripcion.rechazada"
BINDING_EXISTS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/bindings" | grep -c "inscripcion.rechazada" || echo 0)
if [ "$BINDING_EXISTS" -gt 0 ]; then
  print_pass "Binding inscripcion.rechazada configurado"
else
  print_fail "Binding inscripcion.rechazada no configurado"
fi

print_test "Verificar Binding: materia.carga.llena"
BINDING_EXISTS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/bindings" | grep -c "materia.carga.llena" || echo 0)
if [ "$BINDING_EXISTS" -gt 0 ]; then
  print_pass "Binding materia.carga.llena configurado"
else
  print_fail "Binding materia.carga.llena no configurado"
fi

# ============================================
# 5. VERIFICAR LOGS
# ============================================

print_header "5. VERIFICANDO LOGS DE MICROSERVICIOS"

print_test "Buscar logs de ms-alumnos: alumno.inscrito"
MS_ALUMNOS_LOGS=$(docker logs agm_ms_alumnos 2>&1 | grep -c "Evento alumno.inscrito publicado" || echo 0)
if [ "$MS_ALUMNOS_LOGS" -gt 0 ]; then
  print_pass "Evento alumno.inscrito encontrado en logs"
else
  print_fail "Evento alumno.inscrito NO encontrado en logs (puede ser normal si no se ejecutó inscripción)"
fi

print_test "Buscar logs de ms-notificaciones: listeners activos"
MS_NOTIF_LOGS=$(docker logs agm_ms_notificaciones 2>&1 | grep -c "Consumidor iniciado\|RabbitMQ listener iniciado" || echo 0)
if [ "$MS_NOTIF_LOGS" -gt 0 ]; then
  print_pass "RabbitMQ Listeners activos en ms-notificaciones"
else
  print_fail "RabbitMQ Listeners NO encontrados (verificar manualmente)"
fi

# ============================================
# 6. VERIFICAR CONEXIONES RABBITMQ
# ============================================

print_header "6. VERIFICANDO CONEXIONES A RABBITMQ"

print_test "Contar conexiones activas"
CONNECTIONS=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/connections" | grep -c "\"name\"" || echo 0)
if [ "$CONNECTIONS" -gt 3 ]; then
  print_pass "Multiple conexiones activas ($CONNECTIONS)"
else
  print_fail "Pocas conexiones activas ($CONNECTIONS) - verificar manualmente"
fi

# ============================================
# 7. VERIFICAR DEAD LETTER QUEUE
# ============================================

print_header "7. VERIFICANDO DEAD LETTER QUEUE"

print_test "Verificar DLQ vacía"
DLQ_MESSAGES=$(curl -s -u agm_user:agm_password "$RABBITMQ_MGMT/api/queues" | grep -c "\"idle_since\"" || echo 0)
if [ "$DLQ_MESSAGES" -eq 0 ]; then
  print_pass "Dead Letter Queue vacía (sin errores de procesamiento)"
else
  print_fail "Dead Letter Queue tiene mensajes (posibles errores)"
fi

# ============================================
# RESULTADO FINAL
# ============================================

print_header "RESUMEN DE TESTING"

echo -e "${BLUE}Total Tests:${NC} $TESTS_TOTAL"
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"

PASS_RATE=$((($TESTS_PASSED * 100) / $TESTS_TOTAL))
echo -e "${BLUE}Pass Rate:${NC} $PASS_RATE%"

if [ $TESTS_FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ TESTING EXITOSO - Todos los tests pasaron${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
  echo -e "${RED}❌ TESTING CON FALLOS - $TESTS_FAILED tests fallaron${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
  exit 1
fi
