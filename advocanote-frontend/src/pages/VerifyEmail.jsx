
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { verifyEmail } from "../services/auth";

function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token");

    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const handleVerify = async () => {
        if (!token || isVerifying || isVerified) {
            return;
        }

        setMessage("");
        setIsError(false);
        setIsVerifying(true);

        try {
            await verifyEmail(token);

            setIsVerified(true);
            setMessage(
                "Email verified successfully! You can now log in."
            );

        } catch (error) {
            setIsError(true);
            setMessage(
                error.message || "Email verification failed."
            );

        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <main>
            <h1>AdvocaNote</h1>

            <h2>Email Verification</h2>

            {!token ? (
                <p>
                    Verification token is missing.
                    Please open the link sent to your email.
                </p>
            ) : (
                <>
                    <p>
                        Click below to verify your email address.
                    </p>

                    {!isVerified && (
                        <button
                            type="button"
                            onClick={handleVerify}
                            disabled={isVerifying}
                        >
                            {isVerifying
                                ? "Verifying..."
                                : "Verify Email"}
                        </button>
                    )}
                </>
            )}

            {message && (
                <p role="status">
                    {isError ? "Error: " : ""}
                    {message}
                </p>
            )}

            {isVerified && (
                <button
                    type="button"
                    onClick={() => navigate("/login")}
                >
                    Go to Login
                </button>
            )}
        </main>
    );
}

export default VerifyEmail;
