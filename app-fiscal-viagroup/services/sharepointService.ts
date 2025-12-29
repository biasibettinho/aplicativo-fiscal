// sharepointService.ts

const SITE_ID = 'SEU_SITE_ID'; // Formato: dominio.sharepoint.com,guid,guid
const LIST_ID = 'SEU_LIST_ID'; // GUID da lista
const AUX_LIST_ID = 'SEU_ID_DA_LISTA_AUXILIAR'; // GUID da lista de boletos

// Função auxiliar para limpar nomes de arquivos (Resolve o Erro 400)
const sanitizeFileName = (name: string) => {
  return name
    .replace(/[#%*:<>?/|]/g, '') // Remove caracteres proibidos pelo SharePoint
    .replace(/\s+/g, '_')        // Substitui espaços por underline
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .substring(0, 100);          // Limita o tamanho para evitar URLs gigantes
};

// Função para converter File em Base64 (Necessário para anexos de Lista no Graph)
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
  // 1. Criar o item de texto (Já estava funcionando)
  async createRequest(token: string, data: any) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items`;
    
    const payload = {
      fields: {
        Title: data.title,
        InvoiceNumber: data.invoiceNumber,
        OrderNumbers: data.orderNumbers,
        Payee: data.payee,
        PaymentMethod: data.paymentMethod,
        PaymentDate: data.paymentDate,
        GeneralObservation: data.generalObservation,
        Bank: data.bank,
        Agency: data.agency,
        Account: data.account,
        AccountType: data.accountType,
        PixKey: data.pixKey,
        Branch: data.branch,
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
      throw new Error(`Erro ao criar item: ${error.error.message}`);
    }

    return await response.json();
  },

  // 2. Upload de Anexos Corrigido (Resolve o "Resource not found" e "Bad Request")
  async uploadAttachment(token: string, listId: string, itemId: string, file: File) {
    const fileName = sanitizeFileName(file.name);
    
    // URL específica para anexos de itens de lista (Segmento 'attachments')
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/attachments`;

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
          contentType: file.type,
          contentBytes: base64Content // O Graph espera 'contentBytes' para anexos de lista
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Se o erro for que o arquivo já existe, ele apenas ignora ou você pode tratar
        if (errorData.error.code === 'attachmentExists') return;
        
        throw new Error(errorData.error.message || 'Erro desconhecido no upload');
      }
    } catch (error: any) {
      console.error(`Falha no anexo ${file.name}:`, error);
      throw new Error(`Erro ao anexar ${file.name}: ${error.message}`);
    }
  },

  // Funções de atalho para o Dashboard
  async uploadMainAttachment(token: string, itemId: string, file: File) {
    return this.uploadAttachment(token, LIST_ID, itemId, file);
  },

  async uploadAuxiliaryAttachment(token: string, itemId: string, file: File) {
    // Se você usa uma lista separada para boletos, mude o AUX_LIST_ID
    return this.uploadAttachment(token, LIST_ID, itemId, file); 
  },

  // 3. Atualizar item (Para correções)
  async updateRequest(token: string, itemId: string, data: any) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items/${itemId}`;
    
    const payload = {
      fields: {
        ...data,
        Status: 'Pendente' // Ao editar, volta para pendente
      }
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    return await response.json();
  }
};
