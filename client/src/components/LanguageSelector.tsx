import { useLanguage } from "@/lib/i18n.tsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-language-selector">
          <Globe className="w-5 h-5" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-primary/10' : ''}
          data-testid="button-language-en"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('es')}
          className={language === 'es' ? 'bg-primary/10' : ''}
          data-testid="button-language-es"
        >
          Español
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
