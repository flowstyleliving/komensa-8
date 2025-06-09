'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

type MediatorStyle = 'default' | 'nvc' | 'goals';
type TurnMode = 'flexible' | 'strict' | 'moderated' | 'rounds';

interface ChatSettings {
  mediator_style: MediatorStyle;
  turn_taking: TurnMode;
  extensions: {
    id: string;
    name: string;
    enabled: boolean;
  }[];
}

const DEFAULT_SETTINGS: ChatSettings = {
  mediator_style: 'default',
  turn_taking: 'flexible',
  extensions: []
};

export default function ChatSettings() {
  const { chatId } = useParams();
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load initial settings
    fetch(`/api/chats/${chatId}`)
      .then(res => res.json())
      .then(data => setSettings({
        mediator_style: data.mediator_style || DEFAULT_SETTINGS.mediator_style,
        turn_taking: data.turn_taking || DEFAULT_SETTINGS.turn_taking,
        extensions: data.extensions || DEFAULT_SETTINGS.extensions
      }))
      .catch(console.error);
  }, [chatId]);

  const updateSetting = async (key: string, value: any) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      
      if (!response.ok) throw new Error('Failed to update setting');
      
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to update setting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExtension = async (extensionId: string, enabled: boolean) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/extensions/${extensionId}`, {
        method: enabled ? 'POST' : 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to update extension');
      
      setSettings(prev => ({
        ...prev,
        extensions: prev.extensions.map(ext => 
          ext.id === extensionId ? { ...ext, enabled } : ext
        )
      }));
    } catch (error) {
      console.error('Failed to update extension:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Chat Settings</h1>
      
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="mediator-style">Mediator Style</Label>
            <p className="text-sm text-gray-500">Customize the AI mediator's communication style</p>
          </div>
          <Switch
            id="mediator-style"
            checked={settings.mediator_style !== 'default'}
            onCheckedChange={(checked: boolean) => 
              updateSetting('mediator_style', checked ? 'nvc' : 'default')
            }
            disabled={isLoading}
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="turn-taking">Turn Taking Mode</Label>
            <p className="text-sm text-gray-500">How conversation turns are managed</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="flexible"
                name="turn_taking"
                value="flexible"
                checked={settings.turn_taking === 'flexible'}
                onChange={() => updateSetting('turn_taking', 'flexible')}
                disabled={isLoading}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="flexible" className="text-sm font-normal">
                <span className="font-medium">Flexible</span> - Anyone can speak anytime
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="strict"
                name="turn_taking"
                value="strict"
                checked={settings.turn_taking === 'strict'}
                onChange={() => updateSetting('turn_taking', 'strict')}
                disabled={isLoading}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="strict" className="text-sm font-normal">
                <span className="font-medium">Strict</span> - Turn-based with AI facilitating each exchange
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="moderated"
                name="turn_taking"
                value="moderated"
                checked={settings.turn_taking === 'moderated'}
                onChange={() => updateSetting('turn_taking', 'moderated')}
                disabled={isLoading}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="moderated" className="text-sm font-normal">
                <span className="font-medium">Moderated</span> - AI manages conversation flow
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="rounds"
                name="turn_taking"
                value="rounds"
                checked={settings.turn_taking === 'rounds'}
                onChange={() => updateSetting('turn_taking', 'rounds')}
                disabled={isLoading}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="rounds" className="text-sm font-normal">
                <span className="font-medium">Rounds</span> - Turn-based with AI responding after complete rounds
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Chat Extensions</Label>
          <p className="text-sm text-gray-500 mb-4">Enable additional features and integrations</p>
          <div className="space-y-3">
            {settings.extensions.map(extension => (
              <div key={extension.id} className="flex items-center space-x-2">
                <Checkbox
                  id={extension.id}
                  checked={extension.enabled}
                  onCheckedChange={(checked) => 
                    toggleExtension(extension.id, checked as boolean)
                  }
                  disabled={isLoading}
                />
                <Label htmlFor={extension.id}>{extension.name}</Label>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
} 