import { describe, expect, it } from "vitest";
import { maskPhone, validateTelegramCodeInput, validateTelegramPasswordInput } from "./telegram-login";

describe("telegram login flow helpers", () => {
  it("validates Telegram code typed in Settings", () => {
    expect(validateTelegramCodeInput({ code: "30825" })).toEqual({ ok: true, code: "30825" });
    expect(validateTelegramCodeInput({ code: " 12 345 " })).toEqual({ ok: true, code: "12345" });
    expect(validateTelegramCodeInput({ code: "abc" })).toMatchObject({ ok: false, error: "Code Telegram invalide" });
    expect(validateTelegramCodeInput({ code: "123" })).toMatchObject({ ok: false, error: "Code Telegram invalide" });
  });

  it("validates optional Telegram 2FA password without exposing it", () => {
    expect(validateTelegramPasswordInput({ password: "secret-password" })).toEqual({ ok: true, password: "secret-password" });
    expect(validateTelegramPasswordInput({ password: "" })).toMatchObject({ ok: false, error: "Mot de passe 2FA requis" });
  });

  it("masks phone numbers in responses", () => {
    expect(maskPhone("+243991235100")).toBe("+243****5100");
    expect(maskPhone("1234")).toBe("****");
  });
});
