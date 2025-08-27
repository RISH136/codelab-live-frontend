import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useInRouterContext,useNavigate } from "react-router-dom";
import axios from '../config/axios';
import { UserContext } from "../context/user.context";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({ email: "", password: "" });
    const [touched, setTouched] = useState({ email: false, password: false });
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [message, setMessage] = useState("");
    const inRouter = useInRouterContext();
    const navigate=useNavigate();
    const {setUser}=useContext(UserContext);

    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const emailIsValid = useMemo(() => {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
        return re.test(email);
    }, [email]);

    const passwordIsValid = useMemo(() => password.length >= 6, [password]);

    function validate(current = { email, password }) {
        const next = { email: "", password: "" };
        if (!current.email) next.email = "Email is required.";
        else if (!emailIsValid) next.email = "Enter a valid email address.";
        if (!current.password) next.password = "Password is required.";
        else if (!passwordIsValid) next.password = "Password must be at least 6 characters.";
        return next;
    }

    function handleSubmit(e) {
        e.preventDefault();
        const nextErrors = validate();
        setErrors(nextErrors);
        setTouched({ email: true, password: true });
        const hasErrors = Object.values(nextErrors).some(Boolean);
        if (hasErrors) return;
        setLoading(true);
        setMessage("");

        axios
            .post("/users/login", { email, password })
            .then((res) => {
                console.log(res.data);
                localStorage.setItem("token", res.data.token);
                setMessage("Signed in successfully.");
                setUser(res.data.user);
                navigate("/");
            })
            .catch((err) => {
                setMessage(err.response?.data?.message || "Login failed.");
            })
            .finally(() => {
                setLoading(false);
            });
    }


    const emailErrorId = errors.email ? "email-error" : undefined;
    const passwordErrorId = errors.password ? "password-error" : undefined;

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0b0f17] text-white">
            <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-cyan-500/20 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-tr from-cyan-500/20 via-emerald-500/20 to-indigo-500/20 blur-3xl animate-pulse" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
            <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-12">
                <section className={["w-full max-w-md transform transition-all duration-700", mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"].join(" ")}>
                    <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
                        <div className="mb-8 flex items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-900/20 ring-1 ring-white/10">
                                <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow" role="img" aria-label="Logo">
                                    <path d="M12 2l2.4 5.7L20 10l-5.6 2.3L12 18l-2.4-5.7L4 10l5.6-2.3L12 2z" fill="currentColor" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
                                <p className="text-sm text-white/60">Login</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="space-y-6">
                            <div className="relative">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder=" "
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                    aria-invalid={Boolean(errors.email) && touched.email}
                                    aria-describedby={emailErrorId}
                                    className={["peer block w-full rounded-2xl border bg-white/5 px-4 pb-3 pt-5 text-base placeholder-transparent", "outline-none transition-all", "border-white/10 focus:border-white/20 focus:ring-4 focus:ring-indigo-500/20", "text-white/90 shadow-inner shadow-black/20", touched.email && errors.email ? "border-rose-400/40 focus:ring-rose-500/20" : ""].join(" ")}
                                />
                                <label
                                    htmlFor="email"
                                    className={["pointer-events-none absolute left-4 top-3 origin-[0] select-none text-sm text-white/60 transition-all", "peer-placeholder-shown:top-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:opacity-80", "peer-focus:top-1 peer-focus:scale-90 peer-focus:text-white peer-focus:opacity-100", email ? "top-1 scale-90 text-white" : ""].join(" ")}
                                >
                                    Email address
                                </label>
                                {touched.email && errors.email ? (
                                    <p id={emailErrorId} className="mt-2 text-sm text-rose-300">
                                        {errors.email}
                                    </p>
                                ) : null}
                            </div>

                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder=" "
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                                    aria-invalid={Boolean(errors.password) && touched.password}
                                    aria-describedby={passwordErrorId}
                                    className={["peer block w-full rounded-2xl border bg-white/5 px-4 pb-3 pt-5 text-base placeholder-transparent", "outline-none transition-all", "border-white/10 focus:border-white/20 focus:ring-4 focus:ring-indigo-500/20", "text-white/90 shadow-inner shadow-black/20", touched.password && errors.password ? "border-rose-400/40 focus:ring-rose-500/20" : ""].join(" ")}
                                />
                                <label
                                    htmlFor="password"
                                    className={["pointer-events-none absolute left-4 top-3 origin-[0] select-none text-sm text-white/60 transition-all", "peer-placeholder-shown:top-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:opacity-80", "peer-focus:top-1 peer-focus:scale-90 peer-focus:text-white peer-focus:opacity-100", password ? "top-1 scale-90 text-white" : ""].join(" ")}
                                >
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                                            <path d="M2 2l20 20M9.88 9.88A3 3 0 0112 9a3 3 0 013 3c0 .53-.14 1.03-.38 1.46M6.1 6.1C3.9 7.7 2.4 9.86 2 12c.77 3.86 5.23 7 10 7 1.11 0 2.18-.16 3.18-.46M14.12 14.12A3 3 0 0112 15a3 3 0 01-3-3c0-.53.14-1.03.38-1.46M17.9 17.9C20.1 16.3 21.6 14.14 22 12c-.77-3.86-5.23-7-10-7-1.11 0-2.18.16-3.18.46" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                                        </svg>
                                    )}
                                </button>
                                {touched.password && errors.password ? (
                                    <p id={passwordErrorId} className="mt-2 text-sm text-rose-300">
                                        {errors.password}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={["group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 px-5 py-3 text-base font-medium text-white transition", "shadow-lg shadow-indigo-900/30 ring-1 ring-white/10", "focus:outline-none focus:ring-4 focus:ring-indigo-500/30", loading ? "opacity-90 cursor-not-allowed" : "hover:brightness-110 active:brightness-95"].join(" ")}
                            >
                                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition group-hover:translate-x-full" />
                                <span className="relative flex items-center">
                                    {loading ? (
                                        <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                    ) : null}
                                    {loading ? "Signing in…" : "Sign in"}
                                </span>
                            </button>
                        </form>
                        <p className="text-gray-400 mt-4">
                            Don't have an account? <Link to="/register" className="text-blue-500 hover:underline">Create one</Link>
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
