export interface HomeFeature {
  icon: string;
  title: string;
  description: string;
  details?: string;
}

export const HOME_FEATURES: HomeFeature[] = [
  {
    icon: '📊',
    title: 'Gestion de Stock',
    description: 'Suivez vos produits en temps réel avec une gestion de stock intuitive et efficace.',
    details: 'Entrées et sorties de stock, alertes de rupture, inventaires et rapports détaillés pour une visibilité complète sur vos produits.'
  },
  {
    icon: '💰',
    title: 'Comptabilité Simplifiée',
    description: 'Gérez vos ventes, achats et finances avec des outils adaptés aux entreprises maliennes.',
    details: 'Suivi des ventes, encaissements, historique des transactions et indicateurs clés en FCFA.'
  },
  {
    icon: '🧾',
    title: 'Reçus Personnalisés',
    description: 'Créez des reçus professionnels avec vos propres templates et votre logo.',
    details: 'Plusieurs modèles de reçus, personnalisation avec votre charte graphique et impression ou partage numérique.'
  },
  {
    icon: '📱',
    title: 'Mode Offline',
    description: 'Fonctionne même sans connexion internet, synchronisation automatique dès le retour en ligne.',
    details: 'Enregistrez vos ventes et consultez vos données hors ligne. Tout se synchronise automatiquement quand vous êtes reconnecté.'
  }
];
