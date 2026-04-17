import type { z } from "zod";

export interface CardOption {
  value: string;
  label: string;
  description?: string;
  imageUrl?: string;
}

export interface BaseOption {
  value: string | boolean;
  label: string;
  imageUrl?: string;
  emoji?: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
}

export type SyncOptions<T = BaseOption> = T[];
export type SyncOptionsFunction<
  T = BaseOption,
  A extends Record<string, unknown> = Record<string, unknown>,
> = (attrs: A) => T[];
export type QuestionOptions<
  T = BaseOption,
  A extends Record<string, unknown> = Record<string, unknown>,
> = SyncOptions<T> | SyncOptionsFunction<T, A>;

export interface OptionsLoadingState<T = BaseOption> {
  options: T[];
  loading: boolean;
  error: string | null;
}

export interface QuestionConfig<
  A extends Record<string, unknown> = Record<string, unknown>,
> {
  id: keyof A & string;
  title: string;
  description?: string;
  type:
    | "text"
    | "number"
    | "textarea"
    | "radio"
    | "boolean"
    | "card-checkbox"
    | "slider"
    | "rating"
    | "info"
    | "connect";
  options?: QuestionOptions<BaseOption, A>;
  condition?: (attributes: A) => boolean;
  optional?: boolean;
  /** Radio display style — "button" (vertical list) or "card" (2-col grid). */
  variant?: "button" | "card";
  /** Static placeholder for text inputs. */
  placeholder?: string;
  /** Rotating typewriter placeholders for text inputs. */
  placeholders?: string[];
  /** Extra attributes forwarded to text inputs. */
  inputProps?: {
    inputMode?:
      | "none"
      | "text"
      | "tel"
      | "url"
      | "email"
      | "numeric"
      | "decimal"
      | "search";
    autoComplete?: string;
    maxLength?: number;
    pattern?: string;
    type?: "text" | "email" | "number";
  };
  cardCheckboxProps?: {
    singleSelection?: boolean;
  };
  sliderProps?: {
    min?: number;
    max?: number;
    step?: number;
    /** Labels for min and max ends. */
    minLabel?: string;
    maxLabel?: string;
  };
  ratingProps?: {
    /** Number of stars/items. Default 5. */
    max?: number;
  };
  /** Off-site OAuth / install links; optional skip for non-required steps. */
  connect?: {
    label: string;
    href: string;
    required?: boolean;
    comingSoon?: boolean;
    note?: string;
  };
  validationSchema?: z.ZodSchema;
  validationErrorMessage?: string;
}
