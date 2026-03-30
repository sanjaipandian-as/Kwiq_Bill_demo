import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { authStatus } = useAuth();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Initializing authentication…
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
