import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Error capturado en la interfaz:", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="text-center max-w-sm space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Algo ha fallado en esta pantalla</h2>
            <p className="text-sm text-muted-foreground">
              No se ha perdido ningún dato. Puedes reintentar sin salir de la aplicación.
            </p>
            <Button onClick={this.reset}>Reintentar</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
