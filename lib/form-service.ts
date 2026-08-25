import { PDFDocument } from 'pdf-lib';

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'button' | 'unknown';

export interface FormFieldInfo {
  name: string;
  type: FormFieldType;
  currentValue: string | boolean;
  options?: string[];
}

export type FormValues = Record<string, string | boolean>;

/**
 * Reads all AcroForm fields from a PDF, returning a flat list of field info.
 */
export async function getFormFields(pdfBytes: ArrayBuffer): Promise<FormFieldInfo[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const infos: FormFieldInfo[] = [];

  for (const field of fields) {
    try {
      const name = field.getName();
      const type = getFieldType(field);
      const info: FormFieldInfo = { name, type, currentValue: '' };

      switch (type) {
        case 'text': {
          const f = field as import('pdf-lib').PDFTextField;
          info.currentValue = f.getText() ?? '';
          break;
        }
        case 'checkbox': {
          const f = field as import('pdf-lib').PDFCheckBox;
          info.currentValue = f.isChecked();
          break;
        }
        case 'radio': {
          const f = field as import('pdf-lib').PDFRadioGroup;
          info.currentValue = f.getSelected() ?? '';
          info.options = f.getOptions();
          break;
        }
        case 'dropdown': {
          const f = field as import('pdf-lib').PDFDropdown;
          info.currentValue = f.getSelected() ?? '';
          info.options = f.getOptions();
          break;
        }
        case 'optionlist': {
          const f = field as import('pdf-lib').PDFOptionList;
          const selected = f.getSelected() ?? [];
          info.currentValue = selected.join(', ');
          info.options = f.getOptions();
          break;
        }
        default:
          break;
      }

      infos.push(info);
    } catch (err) {
      // Skip fields we can't introspect
      console.debug('Skipped form field', err);
    }
  }

  return infos;
}

function getFieldType(field: unknown): FormFieldType {
  const ctor = (field as object).constructor?.name ?? '';
  if (ctor.includes('TextField')) return 'text';
  if (ctor.includes('CheckBox')) return 'checkbox';
  if (ctor.includes('RadioGroup')) return 'radio';
  if (ctor.includes('Dropdown')) return 'dropdown';
  if (ctor.includes('OptionList')) return 'optionlist';
  if (ctor.includes('Button')) return 'button';
  return 'unknown';
}

/**
 * Applies form values onto a loaded PDFDocument (mutates pdfDoc in place).
 */
export function applyFormValues(pdfDoc: PDFDocument, values: FormValues): void {
  const entries = Object.entries(values);
  if (entries.length === 0) return;
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const byName = new Map<string, unknown>();
  for (const f of fields) {
    try {
      byName.set(f.getName(), f);
    } catch {
      // ignore unnamed
    }
  }

  for (const [name, value] of entries) {
    const field = byName.get(name);
    if (!field) continue;
    const type = getFieldType(field);
    try {
      switch (type) {
        case 'text':
          (field as import('pdf-lib').PDFTextField).setText(String(value ?? ''));
          break;
        case 'checkbox':
          if (value) (field as import('pdf-lib').PDFCheckBox).check();
          else (field as import('pdf-lib').PDFCheckBox).uncheck();
          break;
        case 'radio': {
          const f = field as import('pdf-lib').PDFRadioGroup;
          if (typeof value === 'string' && value) f.select(value);
          break;
        }
        case 'dropdown': {
          const f = field as import('pdf-lib').PDFDropdown;
          if (typeof value === 'string' && value) f.select(value);
          break;
        }
        case 'optionlist': {
          const f = field as import('pdf-lib').PDFOptionList;
          if (typeof value === 'string' && value) {
            f.select(value.split(',').map((s) => s.trim()).filter(Boolean));
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.debug(`Failed to apply value to field "${name}"`, err);
    }
  }
}

/**
 * Flattens all form fields into static content on the page (fields become non-editable).
 */
export function flattenForm(pdfDoc: PDFDocument): void {
  try {
    pdfDoc.getForm().flatten();
  } catch (err) {
    console.warn('Form flatten failed', err);
  }
}
