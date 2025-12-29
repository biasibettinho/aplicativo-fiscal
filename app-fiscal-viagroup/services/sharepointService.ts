// Substitua pelos seus IDs reais
const SITE_ID = 'vialacteoscombr.sharepoint.com,guid-do-site,guid-da-web'; 
const LIST_ID = 'guid-da-lista-principal';

/**
 * Limpa o nome do arquivo para evitar Erro 400 (Bad Request)
 * Remove acentos, caracteres especiais e limita o tamanho.
 */
const sanitizeFileName = (name: string) => {
  const extension = name.split('.').pop();
  const baseName = name.split('.').slice(0, -1).join('.');
  
  return baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[#%*:<>?/|\\"]/g, '') // Remove caracteres proibidos
    .replace(/\s+/g, '_')           // Espaços por underline
    .substring(0, 60)               // Limita tamanho do corpo
    + '.' + extension;
};

/**
 * Converte arquivo para Base64 para envio via Microsoft Graph
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1];
      resolve(base64String || '');
    };
    reader.onerror = (error) => reject(error);
  });
};

export const sharepointService = {
  // Busca as solicitações (Garante que o carregamento volte a funcionar)
  async getRequests(token: string) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error("Falha ao carregar solicitações.");
    const data = await response.json();
    return data.value;
  },

  // Cria o item de texto
  async createRequest(token: string, data: any) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items`;
    
    const payload = {
      fields: {
        Title: data.title || 'Sem Título',
        InvoiceNumber: data.invoiceNumber || '',
        OrderNumbers: data.orderNumbers || '',
        Payee: data.payee || '',
        PaymentMethod: data.paymentMethod || 'Boleto',
        PaymentDate: data.paymentDate,
        GeneralObservation: data.generalObservation || '',
        Bank: data.bank || '',
        Agency: data.agency || '',
        Account: data.account || '',
        AccountType: data.accountType || 'Conta Corrente',
        PixKey: data.pixKey || '',
        Branch: data.branch || 'Matriz SP',
        Status: 'Pendente'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      // Trata o erro de hostname inválido
      if (error.error.code === 'invalidHostname') {
        throw new Error("Configuração de SITE_ID incorreta no servidor.");
      }
      throw new Error(error.error.message);
    }

    return await response.json();
  },

  /**
   * Faz o upload de anexo usando contentBytes (Formato correto para Itens de Lista)
   * Resolve o erro: Resource not found for the segment 'attachments'
   */
  async uploadAttachment(token: string, itemId: string, file: File) {
    const fileName = sanitizeFileName(file.name);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items/${itemId}/attachments`;

    try {
      const base64Content = await fileToBase64(file);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: fileName,
          contentBytes: base64Content
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }
      return true;
    } catch (error: any) {
      throw new Error(`Erro no anexo ${file.name}: ${error.message}`);
    }
  },

  async uploadMainAttachment(token: string, itemId: string, file: File) {
    return this.uploadAttachment(token, itemId, file);
  },

  async uploadAuxiliaryAttachment(token: string, itemId: string, file: File) {
    return this.uploadAttachment(token, itemId, file);
  },

  async updateRequest(token: string, itemId: string, data: any) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items/${itemId}`;
    const payload = { fields: data };
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return response.ok;
  }
};
