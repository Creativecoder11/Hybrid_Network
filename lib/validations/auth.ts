import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your email or ID"),
  password: z.string().min(1, "Password is required"),
  keepSignedIn: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordField = z
  .string()
  .min(8, "Must be at least 8 characters")
  .regex(/[0-9]/, "Must contain at least one number");

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],    
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Enter your email or ID"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
