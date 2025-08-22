const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === "P2002") {
    return res.status(400).json({
      error: "Ya existe un registro con estos datos únicos",
      details: err.meta?.target || "Constraint violation",
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Registro no encontrado",
      details: err.message,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Error de validación",
      details: err.message,
    });
  }

  res.status(500).json({
    error: "Error interno del servidor",
    details:
      process.env.NODE_ENV === "development" ? err.message : "Algo salió mal",
  });
};

module.exports = errorHandler;
