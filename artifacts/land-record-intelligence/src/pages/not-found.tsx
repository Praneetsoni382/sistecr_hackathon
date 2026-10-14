import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md mb-4 flex justify-start">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/dashboard";
            }
          }}
          data-testid="button-notfound-return-workspace"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-800 shadow-xs hover:bg-gray-100 transition"
        >
          <ArrowLeft size={14} className="text-primary" />
          <span>Return to Workspace</span>
        </button>
      </div>
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            The requested location does not exist in the Land Record Intelligence System.
          </p>
          <div className="mt-6 flex justify-end">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 transition"
            >
              Go to Workspace Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
