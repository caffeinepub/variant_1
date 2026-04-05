import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Variant {
    correctOption: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
}
export type SessionId = string;
export interface Session {
    id: SessionId;
    user: Principal;
    variants: Array<Variant>;
    settings: GenerationSettings;
    timestamp: bigint;
    originalQuestion: string;
}
export interface GenerationSettings {
    decimalPrecision: bigint;
    integerOnly: boolean;
    quantity: bigint;
    fractionMode: boolean;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    countSessions(): Promise<bigint>;
    deleteSession(id: SessionId): Promise<void>;
    getAllSessions(): Promise<Array<Session>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getSession(id: SessionId): Promise<Session>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveSession(id: SessionId, originalQuestion: string, settings: GenerationSettings, variants: Array<Variant>): Promise<SessionId>;
}
