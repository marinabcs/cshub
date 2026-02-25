import { useState, useCallback } from 'react';
import { validateForm } from '../validation';

/**
 * Hook genérico para gerenciar formulários com validação Zod.
 *
 * @param {Object} options
 * @param {Object} options.initialValues - Estado inicial do formulário
 * @param {import('zod').ZodSchema} [options.schema] - Schema Zod para validação
 * @param {Function} options.onSubmit - Função async chamada ao submeter (recebe values)
 * @param {Function} [options.onSuccess] - Callback após submit bem-sucedido
 * @param {Function} [options.onError] - Callback após erro no submit (recebe error)
 *
 * @returns {Object} { values, errors, saving, submitError, setValues, setField, handleSubmit, reset, clearErrors }
 */
export function useForm({ initialValues, schema, onSubmit, onSuccess, onError }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const setField = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo ao editar
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setSubmitError(null);
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setSubmitError(null);
    setSaving(false);
  }, [initialValues]);

  const handleSubmit = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();

    // Validar com Zod se schema fornecido
    if (schema) {
      const validationErrors = validateForm(schema, values);
      if (validationErrors) {
        setErrors(validationErrors);
        return false;
      }
    }

    setSaving(true);
    setSubmitError(null);

    try {
      await onSubmit(values);
      if (onSuccess) onSuccess();
      return true;
    } catch (error) {
      const msg = error?.message || 'Erro ao salvar. Tente novamente.';
      setSubmitError(msg);
      if (onError) onError(error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [schema, values, onSubmit, onSuccess, onError]);

  return {
    values,
    errors,
    saving,
    submitError,
    setValues,
    setField,
    handleSubmit,
    reset,
    clearErrors
  };
}
