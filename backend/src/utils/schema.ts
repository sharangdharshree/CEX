import z, { uppercase } from "zod";

// singup schema
export const signupSchema = z.object({
  email: z.string().email().nonempty(),
  username: z.string().nonempty(),
  firstName: z.string().nonempty(),
  lastName: z.string().nonempty(),
  password: z.string().min(8).nonempty(),
});

export const singinSchema = z.object({
  username: z.string().nonempty(),
  password: z.string().min(8).nonempty(),
});
