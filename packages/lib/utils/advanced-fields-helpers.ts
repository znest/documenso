import { type Field, FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../errors/app-error';
import {
  type TFieldMetaSchema,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZRadioFieldMeta,
} from '../types/field-meta';

/**
 * Field types whose fieldMeta must be present and schema-valid. A missing or malformed
 * fieldMeta for these types will crash the seal job in insertFieldInPDF.
 */
const FIELD_TYPES_REQUIRING_META: FieldType[] = [
  FieldType.CHECKBOX,
  FieldType.RADIO,
  FieldType.DROPDOWN,
];

/**
 * Throws a user-facing AppError if the field type requires fieldMeta and the provided
 * value is missing or does not match the schema for that type.
 */
export const assertAdvancedFieldMetaValid = (
  type: FieldType,
  fieldMeta: TFieldMetaSchema | undefined | null,
) => {
  if (!FIELD_TYPES_REQUIRING_META.includes(type)) {
    return;
  }

  if (!fieldMeta) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `${type.toLowerCase()} field is missing required metadata`,
    });
  }

  const parser =
    type === FieldType.CHECKBOX
      ? ZCheckboxFieldMeta
      : type === FieldType.RADIO
        ? ZRadioFieldMeta
        : ZDropdownFieldMeta;

  const result = parser.safeParse(fieldMeta);

  if (!result.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid ${type.toLowerCase()} field metadata: ${result.error.issues
        .map((issue) => issue.message)
        .join(', ')}`,
    });
  }
};

// Currently it seems that the majority of fields have advanced fields for font reasons.
// This array should only contain fields that have an optional setting in the fieldMeta.
export const ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING: FieldType[] = [
  FieldType.NUMBER,
  FieldType.TEXT,
  FieldType.DROPDOWN,
  FieldType.RADIO,
  FieldType.CHECKBOX,
];

/**
 * Whether a field is required to be inserted.
 */
export const isRequiredField = (field: Field) => {
  // All fields without the optional metadata are assumed to be required.
  if (!ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING.includes(field.type)) {
    return true;
  }

  // Not sure why fieldMeta can be optional for advanced fields, but it is.
  // Therefore we must assume if there is no fieldMeta, then the field is optional.
  if (!field.fieldMeta) {
    return false;
  }

  const parsedData = ZFieldMetaSchema.safeParse(field.fieldMeta);

  // If it fails, assume the field is optional.
  // This needs to be logged somewhere.
  if (!parsedData.success) {
    return false;
  }

  return parsedData.data?.required === true;
};

/**
 * Whether the provided field is required and not inserted.
 */
export const isFieldUnsignedAndRequired = (field: Field) =>
  isRequiredField(field) && !field.inserted;

/**
 * Whether the provided fields contains a field that is required to be inserted.
 */
export const fieldsContainUnsignedRequiredField = (fields: Field[]) =>
  fields.some(isFieldUnsignedAndRequired);
