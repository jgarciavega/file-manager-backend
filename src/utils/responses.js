/**
 * Respuesta exitosa estándar
 */
const successResponse = (
  res,
  data,
  message = "Operación exitosa",
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Respuesta de error estándar
 */
const errorResponse = (
  res,
  message = "Error interno",
  statusCode = 500,
  details = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: details,
  });
};

/**
 * Respuesta paginada
 */
const paginatedResponse = (
  res,
  data,
  pagination,
  message = "Datos obtenidos exitosamente"
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
