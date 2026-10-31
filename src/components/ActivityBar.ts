import { iconFiles, iconSearch, iconGitBranch, iconExtensions, iconSettings, iconUser } from './icons';

export interface ActivityBarItem {
    id: string;
    title: string;
    icon: (size?: number, color?: string) => string;
    position: 'top' | 'bottom';
}

export class ActivityBarManager {
    private container: HTMLElement;
    private topContainer: HTMLElement;
    private bottomContainer: HTMLElement;
    private activePanelId: string = 'explorer';
    private badges: Map<string, number> = new Map();
    
    public onPanelChange?: (panelId: string, isSamePanel?: boolean) => void;

    private items: ActivityBarItem[] = [
        { id: 'explorer', title: 'Dosya Gezgini', icon: iconFiles, position: 'top' },
        { id: 'search', title: 'Arama', icon: iconSearch, position: 'top' },
        { id: 'sourceControl', title: 'Kaynak Kontrolü', icon: iconGitBranch, position: 'top' },
        { id: 'extensions', title: 'Eklentiler', icon: iconExtensions, position: 'top' },
        { id: 'account', title: 'Hesap', icon: iconUser, position: 'bottom' },
        { id: 'settings', title: 'Ayarlar', icon: iconSettings, position: 'bottom' }
    ];

    constructor(container?: HTMLElement | null) {
        let el = container;
        if (!el) {
            el = (document.getElementById('activityBar') || 
                  document.getElementById('activityBarContainer') || 
                  document.querySelector('.activity-bar')) as HTMLElement | null;
        }
        if (!el) {
            console.warn('[ActivityBarManager] Container not found, creating fallback element.');
            el = document.createElement('nav');
            el.id = 'activityBar';
            el.className = 'activity-bar';
            const workbench = document.querySelector('.ide-workbench') || document.body;
            workbench.prepend(el);
        }
        this.container = el;
        this.container.classList.add('activity-bar');
        
        this.topContainer = document.createElement('div');
        this.topContainer.classList.add('activity-bar__top');
        
        this.bottomContainer = document.createElement('div');
        this.bottomContainer.classList.add('activity-bar__bottom');
        
        this.container.innerHTML = '';
        this.container.appendChild(this.topContainer);
        this.container.appendChild(this.bottomContainer);
        
        this.render();
    }

    private render(): void {
        this.topContainer.innerHTML = '';
        this.bottomContainer.innerHTML = '';

        this.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('activity-bar__item');
            
            if (this.activePanelId === item.id) {
                itemElement.classList.add('activity-bar__item--active');
            }
            
            itemElement.title = item.title;
            itemElement.setAttribute('data-id', item.id);
            
            const iconWrapper = document.createElement('div');
            iconWrapper.classList.add('activity-bar__icon');
            iconWrapper.innerHTML = item.icon(24);
            itemElement.appendChild(iconWrapper);

            if (this.badges.has(item.id)) {
                const count = this.badges.get(item.id)!;
                if (count > 0) {
                    const badgeElement = document.createElement('div');
                    badgeElement.classList.add('activity-bar__badge');
                    badgeElement.textContent = count > 99 ? '99+' : count.toString();
                    itemElement.appendChild(badgeElement);
                }
            }

            itemElement.addEventListener('click', () => {
                const isSamePanel = this.activePanelId === item.id;
                if (item.position === 'top') {
                    this.setActivePanel(item.id);
                }
                if (this.onPanelChange) {
                    this.onPanelChange(item.id, isSamePanel);
                }
            });

            if (item.position === 'top') {
                this.topContainer.appendChild(itemElement);
            } else {
                this.bottomContainer.appendChild(itemElement);
            }
        });
    }

    public getActivePanelId(): string {
        return this.activePanelId;
    }

    public setActivePanel(panelId: string): void {
        this.activePanelId = panelId;
        this.render();
    }

    public setBadge(panelId: string, count: number): void {
        this.badges.set(panelId, count);
        this.render();
    }
}
