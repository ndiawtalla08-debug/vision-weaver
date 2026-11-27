-- « Mes annonces » : champs supplémentaires, non destructif (ajouts de colonnes uniquement).
ALTER TABLE announcements ADD COLUMN subcategory TEXT;
ALTER TABLE announcements ADD COLUMN negotiable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN location TEXT;
ALTER TABLE announcements ADD COLUMN attributes TEXT;
ALTER TABLE announcements ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
-- Brouillon privé : jamais visible publiquement, quel que soit le statut de modération.
ALTER TABLE announcements ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;
