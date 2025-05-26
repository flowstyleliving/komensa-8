'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

type MediatorStyle = 'default' | 'nvc' | 'goals';
type TurnTaking = 'strict' | 'flexible';

interface ChatSettings {
  mediator_style: MediatorStyle;
  turn_taking: TurnTaking;
  extensions: {
    id: string;
    name: string;
    enabled: boolean;
  }[];
}

const DEFAULT_SETTINGS: ChatSettings = {
  mediator_style: 'default',
  turn_taking: 'strict',
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

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="turn-taking">Strict Turn Taking</Label>
            <p className="text-sm text-gray-500">Enforce structured back-and-forth conversation</p>
          </div>
          <Switch
            id="turn-taking"
            checked={settings.turn_taking === 'strict'}
            onCheckedChange={(checked: boolean) => 
              updateSetting('turn_taking', checked ? 'strict' : 'flexible')
            }
            disabled={isLoading}
          />
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